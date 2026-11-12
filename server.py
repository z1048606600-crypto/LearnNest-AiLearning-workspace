"""LearnNest: a private, dependency-free learning dashboard."""

from __future__ import annotations

import argparse
import concurrent.futures
import contextlib
import datetime as dt
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import ssl
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("LEARNNEST_DATA", str(ROOT / "data")))
DB_PATH = DATA_DIR / "learnnest.sqlite3"
REFRESH_SECONDS = 30 * 60
MAX_FEED_BYTES = 4 * 1024 * 1024
SYNC_LOCK = threading.Lock()

SOURCES = [
    ("Hugging Face Blog", "https://huggingface.co/blog/feed.xml", "news", "HF", "#f59e0b"),
    ("GitHub Blog", "https://github.blog/feed/", "news", "GH", "#384152"),
    ("arXiv · 机器学习", "https://rss.arxiv.org/rss/cs.LG", "papers", "aX", "#b65050"),
    ("arXiv · 人工智能", "https://rss.arxiv.org/rss/cs.AI", "papers", "aX", "#b65050"),
    ("LangGraph Releases", "https://github.com/langchain-ai/langgraph/releases.atom", "github", "LG", "#378e74"),
    ("PyTorch Releases", "https://github.com/pytorch/pytorch/releases.atom", "github", "PT", "#e16a48"),
]

RESOURCES = [
    ("动手学深度学习", "中文教材与可运行代码，从线性回归到 Transformer，循序建立深度学习基础。", "https://zh.d2l.ai/", "深度学习", "课程", "入门", "李沐 · D2L", "D2", "#5473cf"),
    ("Hugging Face Agents Course", "通过工具调用、工作流和实战项目，学习构建能执行任务的 AI Agent。", "https://huggingface.co/learn/agents-course/", "Agent", "课程", "入门", "Hugging Face", "HF", "#d69a28"),
    ("PyTorch Tutorials", "从张量、自动求导到模型训练，跟随官方教程亲手完成深度学习实验。", "https://pytorch.org/tutorials/", "深度学习", "文档", "入门", "PyTorch", "PT", "#df7355"),
    ("LangGraph", "学习带有状态、持久化和人工参与的 Agent 工作流，搭建多步骤应用。", "https://docs.langchain.com/oss/python/langgraph/overview", "Agent", "文档", "进阶", "LangChain", "LG", "#459e85"),
    ("Kaggle Learn", "用短课程和在线练习学习 Python、机器学习与数据处理。", "https://www.kaggle.com/learn", "机器学习", "实战", "入门", "Kaggle", "K", "#36a8c2"),
    ("Google Colab", "直接在浏览器中运行 Notebook、训练和调试模型；计算资源按平台配额提供。", "https://colab.research.google.com/", "开发工具", "工具", "入门", "Google", "Co", "#d9a235"),
    ("Hugging Face LLM Course", "学习 Transformers、数据集和 Tokenizer，了解语言模型的训练与使用。", "https://huggingface.co/learn/llm-course/", "大模型", "课程", "进阶", "Hugging Face", "HF", "#d69a28"),
    ("Made With ML", "通过项目学习从模型开发到测试、部署和持续改进的完整流程。", "https://madewithml.com/", "机器学习", "实战", "进阶", "Made With ML", "ML", "#8471c0"),
    ("Ollama", "在本地运行和调用开源模型，为 Agent 实验搭建模型服务。", "https://ollama.com/", "开发工具", "工具", "进阶", "Ollama", "Ol", "#626971"),
    ("smolagents", "用简洁的 Python 代码搭建工具型 Agent，理解执行循环与工具接口。", "https://huggingface.co/docs/smolagents/", "Agent", "文档", "进阶", "Hugging Face", "sm", "#d69a28"),
    ("Dive into Deep Learning · GitHub", "配套教材代码仓库，可以查看 Notebook、版本更新与社区讨论。", "https://github.com/d2l-ai/d2l-en", "深度学习", "项目", "入门", "d2l-ai", "GH", "#59616d"),
    ("Full Stack Deep Learning", "面向真实应用，学习深度学习系统的设计、部署与产品开发。", "https://fullstackdeeplearning.com/", "大模型", "课程", "进阶", "FSDL", "FS", "#44798e"),
]


def utcnow():
    return dt.datetime.now(dt.timezone.utc).isoformat()


@contextlib.contextmanager
def database():
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with database() as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sources (
          id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
          kind TEXT NOT NULL, icon TEXT NOT NULL, color TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1, last_attempt TEXT, last_success TEXT,
          error TEXT, etag TEXT, modified TEXT);
        CREATE TABLE IF NOT EXISTS resources (
          id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
          url TEXT NOT NULL UNIQUE, category TEXT NOT NULL, type TEXT NOT NULL,
          level TEXT NOT NULL, provider TEXT NOT NULL, icon TEXT NOT NULL,
          color TEXT NOT NULL, favorite INTEGER NOT NULL DEFAULT 0,
          progress INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS items (
          id TEXT PRIMARY KEY, source_id INTEGER NOT NULL, title TEXT NOT NULL,
          url TEXT NOT NULL, description TEXT NOT NULL, published TEXT,
          fetched TEXT NOT NULL, favorite INTEGER NOT NULL DEFAULT 0,
          read INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX IF NOT EXISTS items_source ON items(source_id);
        """)
        if not db.execute("SELECT 1 FROM settings WHERE key='initialized'").fetchone():
            db.executemany("INSERT INTO sources(name,url,kind,icon,color) VALUES(?,?,?,?,?)", SOURCES)
            db.executemany("INSERT INTO resources(title,description,url,category,type,level,provider,icon,color,created) VALUES(?,?,?,?,?,?,?,?,?,?)", [(*r, utcnow()) for r in RESOURCES])
            db.execute("INSERT INTO settings VALUES('initialized','1')")
            db.execute("INSERT INTO settings VALUES('auto_refresh','true')")


def plain_text(value):
    import html
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value or ""))).strip()


def public_url(value):
    """Prevent custom feeds and redirects from reaching local services."""
    try:
        parsed = urllib.parse.urlsplit(value)
        if parsed.scheme not in ("https", "http") or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("请输入 http 或 https 网站地址")
        if parsed.port not in (None, 80, 443):
            raise ValueError("订阅地址仅支持标准 HTTP / HTTPS 端口")
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise ValueError("订阅地址必须是公开的网站")
    except socket.gaierror as exc:
        raise ValueError("无法解析网站地址，请检查网络或域名") from exc
    return value


def web_url(value):
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme not in ("https", "http") or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("请输入有效的 http 或 https 地址")
    return value


class PublicRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def child_text(node, *names):
    for name in names:
        child = node.find(name)
        if child is not None:
            return "".join(child.itertext()).strip()
    return ""


def parse_feed(raw, base_url):
    class NoDTD(ET.TreeBuilder):
        def doctype(self, name, pubid, system):
            raise ValueError("此订阅使用了不支持的 XML 声明")
    root = ET.fromstring(raw, parser=ET.XMLParser(target=NoDTD()))
    atom = "{http://www.w3.org/2005/Atom}"
    if root.tag == atom + "feed":
        nodes = root.findall(atom + "entry")
        mode = "atom"
    elif root.tag == "rss":
        nodes = root.findall("channel/item")
        mode = "rss"
    elif root.tag.endswith("RDF"):
        nodes = root.findall("{http://purl.org/rss/1.0/}item")
        mode = "rdf"
    else:
        raise ValueError("未找到 RSS / Atom 内容，请填写订阅地址，而非普通网页")
    results = []
    for node in nodes[:80]:
        if mode == "atom":
            link = next((n.get("href", "") for n in node.findall(atom + "link") if n.get("rel", "alternate") == "alternate"), "")
            title = child_text(node, atom + "title")
            summary = child_text(node, atom + "summary", atom + "content")
            published = child_text(node, atom + "published", atom + "updated")
        else:
            prefix = "{http://purl.org/rss/1.0/}" if mode == "rdf" else ""
            link = child_text(node, prefix + "link")
            title = child_text(node, prefix + "title")
            summary = child_text(node, prefix + "description", "{http://purl.org/rss/1.0/modules/content/}encoded")
            published = child_text(node, "pubDate", "{http://purl.org/dc/elements/1.1/}date")
        link = urllib.parse.urljoin(base_url, link)
        if not title or not link or urllib.parse.urlsplit(link).scheme not in ("http", "https"):
            continue
        if published:
            try:
                from email.utils import parsedate_to_datetime
                try:
                    date = dt.datetime.fromisoformat(published.replace("Z", "+00:00"))
                except ValueError:
                    date = parsedate_to_datetime(published)
                if date.tzinfo is None:
                    date = date.replace(tzinfo=dt.timezone.utc)
                published = date.astimezone(dt.timezone.utc).isoformat()
            except (ValueError, TypeError, OverflowError):
                published = None
        results.append({"title": plain_text(title)[:500], "url": link, "description": plain_text(summary)[:1800], "published": published or None})
    return results


def fetch_source(source):
    now = utcnow()
    try:
        public_url(source["url"])
        headers = {"User-Agent": "LearnNest/1.0 (personal RSS reader)", "Accept": "application/atom+xml,application/rss+xml,application/xml,text/xml"}
        if source["etag"]:
            headers["If-None-Match"] = source["etag"]
        if source["modified"]:
            headers["If-Modified-Since"] = source["modified"]
        # Keep Windows trust roots and add Mozilla roots when certifi is present.
        # Certificate and hostname verification remain enabled.
        context = ssl.create_default_context()
        try:
            import certifi
            context.load_verify_locations(certifi.where())
        except ImportError:
            pass
        opener = urllib.request.build_opener(PublicRedirects(), urllib.request.HTTPSHandler(context=context))
        try:
            response = opener.open(urllib.request.Request(source["url"], headers=headers), timeout=18)
        except urllib.error.HTTPError as exc:
            if exc.code != 304:
                raise
            with database() as db:
                db.execute("UPDATE sources SET last_attempt=?,last_success=?,error=NULL WHERE id=?", (now, now, source["id"]))
            return
        with response:
            raw = response.read(MAX_FEED_BYTES + 1)
            if len(raw) > MAX_FEED_BYTES:
                raise ValueError("订阅内容超过 4 MB 限制")
            entries = parse_feed(raw, response.url)
            etag, modified = response.headers.get("ETag"), response.headers.get("Last-Modified")
        if not entries and urllib.parse.urlsplit(source["url"]).hostname == "rss.arxiv.org":
            category = urllib.parse.urlsplit(source["url"]).path.rsplit("/", 1)[-1]
            if re.fullmatch(r"[A-Za-z0-9.-]+", category):
                fallback = "https://export.arxiv.org/api/query?" + urllib.parse.urlencode({"search_query": "cat:" + category, "sortBy": "submittedDate", "sortOrder": "descending", "max_results": 30})
                public_url(fallback)
                with opener.open(urllib.request.Request(fallback, headers={"User-Agent": headers["User-Agent"]}), timeout=18) as response:
                    raw = response.read(MAX_FEED_BYTES + 1)
                    if len(raw) > MAX_FEED_BYTES:
                        raise ValueError("论文内容超过 4 MB 限制")
                    entries = parse_feed(raw, response.url)
                # Query the official API again if the daily RSS remains empty.
                etag, modified = None, None
        with database() as db:
            if not db.execute("SELECT 1 FROM sources WHERE id=?", (source["id"],)).fetchone():
                return
            for entry in entries:
                identifier = hashlib.sha256((str(source["id"]) + ":" + entry["url"]).encode()).hexdigest()[:32]
                db.execute("""INSERT INTO items(id,source_id,title,url,description,published,fetched) VALUES(?,?,?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,published=excluded.published""", (identifier, source["id"], entry["title"], entry["url"], entry["description"], entry["published"], now))
            db.execute("UPDATE sources SET last_attempt=?,last_success=?,error=NULL,etag=?,modified=? WHERE id=?", (now, now, etag, modified, source["id"]))
            # Bound the cache while preserving saved articles.
            db.execute("DELETE FROM items WHERE source_id=? AND favorite=0 AND id NOT IN (SELECT id FROM items WHERE source_id=? ORDER BY COALESCE(published,fetched) DESC LIMIT 250)", (source["id"], source["id"]))
    except Exception as exc:
        print(f"Subscription {source['id']}: {type(exc).__name__}: {str(exc)[:240]}", flush=True)
        if isinstance(exc, urllib.error.HTTPError):
            error = f"网站返回 HTTP {exc.code}，可稍后重试"
        elif isinstance(exc, (TimeoutError, socket.timeout)):
            error = "连接超时，请检查网络后重试"
        elif isinstance(exc, ET.ParseError):
            error = "订阅内容格式有误，暂时无法解析"
        elif isinstance(exc, urllib.error.URLError):
            error = "网站证书验证失败，请检查系统证书或代理配置" if isinstance(exc.reason, ssl.SSLCertVerificationError) else "连接失败，请检查网络或订阅地址"
        else:
            error = str(exc)[:180]
        with database() as db:
            db.execute("UPDATE sources SET last_attempt=?,error=? WHERE id=?", (now, error, source["id"]))


def sync_sources():
    if not SYNC_LOCK.acquire(blocking=False):
        return
    try:
        with database() as db:
            sources = [dict(r) for r in db.execute("SELECT * FROM sources WHERE enabled=1")]
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(fetch_source, sources))
    finally:
        SYNC_LOCK.release()


def scheduler():
    while True:
        with database() as db:
            auto = db.execute("SELECT value FROM settings WHERE key='auto_refresh'").fetchone()[0] == "true"
            row = db.execute("SELECT MAX(last_attempt) FROM sources WHERE enabled=1").fetchone()
        last = dt.datetime.fromisoformat(row[0]).timestamp() if row[0] else 0
        if auto and time.time() - last >= REFRESH_SECONDS:
            sync_sources()
        time.sleep(15)


def state():
    with database() as db:
        return {"resources": [dict(r) for r in db.execute("SELECT * FROM resources ORDER BY id")],
                "sources": [dict(r) for r in db.execute("SELECT id,name,url,kind,icon,color,enabled,last_attempt,last_success,error FROM sources ORDER BY id")],
                "items": [dict(r) for r in db.execute("SELECT items.*,sources.name AS source_name,sources.kind,sources.icon,sources.color FROM items JOIN sources ON sources.id=items.source_id ORDER BY COALESCE(published,fetched) DESC LIMIT 1200")],
                "auto_refresh": db.execute("SELECT value FROM settings WHERE key='auto_refresh'").fetchone()[0] == "true",
                "syncing": SYNC_LOCK.locked(), "refresh_minutes": REFRESH_SECONDS // 60}


def required(data, field, limit=200):
    value = str(data.get(field, "")).strip()
    if not value or len(value) > limit:
        raise ValueError(f"{field} 不能为空，且不能超过 {limit} 字符")
    return value


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        if args and str(args[0]).startswith("GET /api/state"):
            return
        super().log_message(format, *args)

    def send_data(self, data, status=200):
        raw = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if not self.valid_host():
            return self.send_data({"error": "无效的请求地址"}, 403)
        path = urllib.parse.urlsplit(self.path).path
        if path == "/api/state":
            return self.send_data(state())
        if path == "/api/export":
            return self.send_data(state())
        files = {"/": ("index.html", "text/html; charset=utf-8"), "/app.js": ("app.js", "text/javascript; charset=utf-8"), "/styles.css": ("styles.css", "text/css; charset=utf-8"), "/favicon.svg": ("favicon.svg", "image/svg+xml")}
        if path not in files:
            return self.send_data({"error": "页面不存在"}, 404)
        name, mime = files[path]
        raw = (ROOT / "web" / name).read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
        self.end_headers()
        self.wfile.write(raw)

    def valid_host(self):
        return self.headers.get("Host", "") in (f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}")

    def do_POST(self):
        # Mutations are limited to same-origin requests to this local instance.
        origin = self.headers.get("Origin")
        allowed_origins = (f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}")
        if not self.valid_host() or (origin and origin not in allowed_origins) or self.headers.get("Content-Type", "").split(";")[0] != "application/json":
            return self.send_data({"error": "请求来源无效"}, 403)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 65536:
                raise ValueError("请求过大或为空")
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("无效的请求内容")
            result = self.mutate(urllib.parse.urlsplit(self.path).path, data)
            self.send_data(result)
        except (ValueError, TypeError, KeyError, sqlite3.IntegrityError) as exc:
            self.send_data({"error": str(exc) if not isinstance(exc, sqlite3.IntegrityError) else "这个地址已添加，请勿重复添加"}, 400)
        except Exception:
            self.send_data({"error": "保存失败，请稍后重试"}, 500)

    def mutate(self, path, data):
        if path == "/api/refresh":
            threading.Thread(target=sync_sources, daemon=True).start()
            return {"ok": True}
        with database() as db:
            if path == "/api/resource/add":
                title, url = required(data, "title"), web_url(required(data, "url", 2000))
                category = required(data, "category", 40)
                resource_type = required(data, "type", 40)
                db.execute("INSERT INTO resources(title,description,url,category,type,level,provider,icon,color,created) VALUES(?,?,?,?,?,?,?,?,?,?)", (title, str(data.get("description", ""))[:1800], url, category, resource_type, "自选", urllib.parse.urlsplit(url).hostname, title[:2], "#438e7a", utcnow()))
            elif path == "/api/resource/update":
                identifier = int(data["id"])
                if "favorite" in data:
                    db.execute("UPDATE resources SET favorite=? WHERE id=?", (int(bool(data["favorite"])), identifier))
                if "progress" in data:
                    progress = int(data["progress"])
                    if not 0 <= progress <= 100:
                        raise ValueError("学习进度应在 0 到 100 之间")
                    db.execute("UPDATE resources SET progress=? WHERE id=?", (progress, identifier))
            elif path == "/api/resource/delete":
                db.execute("DELETE FROM resources WHERE id=?", (int(data["id"]),))
            elif path == "/api/item/update":
                if "favorite" in data:
                    db.execute("UPDATE items SET favorite=? WHERE id=?", (int(bool(data["favorite"])), str(data["id"])))
                if "read" in data:
                    db.execute("UPDATE items SET read=? WHERE id=?", (int(bool(data["read"])), str(data["id"])))
            elif path == "/api/items/read":
                db.execute("UPDATE items SET read=1")
            elif path == "/api/source/add":
                name, url = required(data, "name"), web_url(required(data, "url", 2000))
                kind = data.get("kind", "news")
                if kind not in ("news", "papers", "github"):
                    raise ValueError("不支持的订阅分类")
                parsed = urllib.parse.urlsplit(url)
                parts = [p for p in parsed.path.split("/") if p]
                if parsed.hostname == "github.com" and len(parts) == 2:
                    url = f"https://github.com/{parts[0]}/{parts[1]}/releases.atom"
                if db.execute("SELECT COUNT(*) FROM sources").fetchone()[0] >= 50:
                    raise ValueError("最多支持 50 个订阅源")
                db.execute("INSERT INTO sources(name,url,kind,icon,color) VALUES(?,?,?,?,?)", (name, url, kind, {"news": "RS", "papers": "aX", "github": "GH"}[kind], {"news": "#497fba", "papers": "#b65050", "github": "#378e74"}[kind]))
            elif path == "/api/source/update":
                db.execute("UPDATE sources SET enabled=? WHERE id=?", (int(bool(data["enabled"])), int(data["id"])))
            elif path == "/api/source/delete":
                identifier = int(data["id"])
                db.execute("DELETE FROM items WHERE source_id=?", (identifier,))
                db.execute("DELETE FROM sources WHERE id=?", (identifier,))
            elif path == "/api/settings":
                db.execute("UPDATE settings SET value=? WHERE key='auto_refresh'", ("true" if data.get("auto_refresh") else "false",))
            else:
                raise ValueError("未知操作")
        return {"ok": True}


def main():
    parser = argparse.ArgumentParser(description="LearnNest 本地学习工作台")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-sync", action="store_true", help="禁用本进程的自动订阅更新")
    args = parser.parse_args()
    init_db()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    if not args.no_sync:
        threading.Thread(target=scheduler, daemon=True).start()
    print(f"LearnNest is running at http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
