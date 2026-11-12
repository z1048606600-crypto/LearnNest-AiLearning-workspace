"""Read-only network diagnostics for the built-in subscriptions."""
import concurrent.futures
import urllib.request
import ssl
import sys
import server


def check(source):
    name, url = source[:2]
    try:
        context = ssl.create_default_context()
        try:
            import certifi
            context.load_verify_locations(certifi.where())
        except ImportError:
            pass
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "LearnNest/1.0"}), timeout=20, context=context) as response:
            raw = response.read(4 * 1024 * 1024)
            print(name, response.status, response.headers.get("Content-Type"), repr(raw[:200]), flush=True)
            try:
                print(name, "entries:", len(server.parse_feed(raw, url)), flush=True)
            except Exception as exc:
                print(name, "parse:", repr(exc), flush=True)
    except Exception as exc:
        print(name, type(exc).__name__, repr(exc), flush=True)


if __name__ == "__main__":
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(check, [*server.SOURCES, ("arXiv API", "https://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=submittedDate&sortOrder=descending&max_results=20")]))
    if "--sync" in sys.argv:
        print("Verifying collector:", flush=True)
        server.init_db()
        server.sync_sources()
        snapshot = server.state()
        print("Cached entries:", len(snapshot["items"]), flush=True)
        for source in snapshot["sources"]:
            print(source["name"], source["error"] or "OK", flush=True)
