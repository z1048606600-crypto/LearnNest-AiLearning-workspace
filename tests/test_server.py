import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

import server


class FeedTests(unittest.TestCase):
    def test_rss_cdata_and_html_are_plain_text(self):
        xml = b'''<rss version="2.0"><channel><item><title>Test &amp; learn</title><link>https://example.com/article</link><description><![CDATA[<!DOCTYPE html><p>Useful <b>research</b></p>]]></description><pubDate>Thu, 12 Nov 2026 00:00:00 GMT</pubDate></item></channel></rss>'''
        item = server.parse_feed(xml, "https://example.com/feed")[0]
        self.assertEqual(item["title"], "Test & learn")
        self.assertEqual(item["description"], "Useful research")
        self.assertEqual(item["published"], "2026-11-12T00:00:00+00:00")

    def test_atom_relative_url_and_missing_date(self):
        xml = b'''<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Release</title><link rel="self" href="/api/1"/><link href="/release/1"/><summary>Changes</summary></entry></feed>'''
        item = server.parse_feed(xml, "https://example.com/feed")[0]
        self.assertEqual(item["url"], "https://example.com/release/1")
        self.assertIsNone(item["published"])

    def test_rdf(self):
        xml = b'''<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/"><item><title>Paper</title><link>https://example.com/paper</link><description>Abstract</description></item></rdf:RDF>'''
        self.assertEqual(server.parse_feed(xml, "https://example.com")[0]["title"], "Paper")

    def test_dtd_entities_and_non_feed_documents_rejected(self):
        for xml in (b'<!DOCTYPE rss [<!ENTITY a "test">]><rss><channel/></rss>', b'<html><body>Not a feed</body></html>'):
            with self.assertRaises(ValueError):
                server.parse_feed(xml, "https://example.com")

    def test_unsafe_item_urls_are_not_returned(self):
        xml = b'<rss><channel><item><title>Bad</title><link>javascript:alert(1)</link></item></channel></rss>'
        self.assertEqual(server.parse_feed(xml, "https://example.com"), [])

    def test_private_addresses_rejected(self):
        for address in ("http://127.0.0.1/feed", "http://[::1]/feed", "http://192.168.1.1/feed", "file:///tmp/feed", "https://example.com:8765/feed", "https://user:pass@example.com/feed"):
            with self.assertRaises(ValueError):
                server.public_url(address)


class LocalApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        (server.ROOT / "data").mkdir(exist_ok=True)
        cls.temp = tempfile.TemporaryDirectory(dir=server.ROOT / "data", prefix="test-")
        cls.original_data, cls.original_db = server.DATA_DIR, server.DB_PATH
        server.DATA_DIR = Path(cls.temp.name)
        server.DB_PATH = server.DATA_DIR / "test.sqlite3"
        server.init_db()
        cls.http = server.ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.http.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join(timeout=2)
        server.DATA_DIR, server.DB_PATH = cls.original_data, cls.original_db
        cls.temp.cleanup()

    def request(self, path, body=None, origin=None):
        req = urllib.request.Request(self.base + path, data=None if body is None else json.dumps(body).encode(), headers={"Content-Type": "application/json", **({"Origin": origin} if origin else {})})
        with urllib.request.urlopen(req) as response:
            return json.load(response)

    def test_resource_crud_and_persistence(self):
        self.request("/api/resource/add", {"title":"Test course","url":"https://example.com/course","category":"Agent","type":"课程","description":"Practice"})
        resource = next(r for r in self.request("/api/state")["resources"] if r["title"] == "Test course")
        self.request("/api/resource/update", {"id":resource["id"],"favorite":True,"progress":65})
        server.init_db()  # A restart must not overwrite records or restore deleted defaults.
        saved = next(r for r in self.request("/api/state")["resources"] if r["id"] == resource["id"])
        self.assertEqual((saved["favorite"], saved["progress"]), (1,65))
        self.request("/api/resource/delete", {"id":resource["id"]})
        self.assertFalse(any(r["id"] == resource["id"] for r in self.request("/api/state")["resources"]))

    def test_github_repository_conversion_and_source_toggle(self):
        self.request("/api/source/add", {"name":"Test repo","url":"https://github.com/example/repository","kind":"github"})
        source = next(s for s in self.request("/api/state")["sources"] if s["name"] == "Test repo")
        self.assertEqual(source["url"], "https://github.com/example/repository/releases.atom")
        self.request("/api/source/update", {"id":source["id"],"enabled":False})
        self.assertEqual(next(s for s in self.request("/api/state")["sources"] if s["id"]==source["id"])["enabled"], 0)
        self.request("/api/source/delete", {"id":source["id"]})

    def test_validation_and_foreign_origin(self):
        for path,body,origin,expected in [
            ("/api/resource/update",{"id":1,"progress":101},None,400),
            ("/api/resource/add",{"title":"Unsafe","url":"javascript:alert(1)","category":"Agent","type":"课程"},None,400),
            ("/api/settings",{"auto_refresh":False},"https://untrusted.example",403),
        ]:
            with self.subTest(path=path, body=body):
                with self.assertRaises(urllib.error.HTTPError) as error:
                    self.request(path,body,origin)
                self.assertEqual(error.exception.code,expected)

    def test_sync_keeps_read_and_saved_flags_and_failure_keeps_cache(self):
        source = self.request("/api/state")["sources"][0]
        with server.database() as db:
            full_source = dict(db.execute("SELECT * FROM sources WHERE id=?", (source["id"],)).fetchone())
        raw = b'<rss><channel><item><title>Real fixture</title><link>https://example.com/fixture</link><description>v1</description></item></channel></rss>'

        class Response:
            url = "https://example.com/feed"
            headers = {}
            def read(self, maximum):
                return raw
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass

        with patch.object(server, "public_url", return_value=True), patch("urllib.request.build_opener") as opener:
            opener.return_value.open.return_value = Response()
            server.fetch_source(full_source)
            item = next(i for i in self.request("/api/state")["items"] if i["title"] == "Real fixture")
            self.request("/api/item/update", {"id":item["id"],"favorite":True,"read":True})
            server.fetch_source(full_source)
        with patch.object(server, "public_url", side_effect=ValueError("Network unavailable")):
            server.fetch_source(full_source)
        snapshot = self.request("/api/state")
        item = next(i for i in snapshot["items"] if i["id"] == item["id"])
        self.assertEqual((item["favorite"],item["read"]),(1,1))
        self.assertEqual(next(s for s in snapshot["sources"] if s["id"]==source["id"])["error"],"Network unavailable")
        self.assertIn("resources", self.request("/api/export"))


if __name__ == "__main__":
    unittest.main()
