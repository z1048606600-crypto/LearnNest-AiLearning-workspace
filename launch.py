"""Launch the existing local workspace or start it and open the browser."""
import threading
import urllib.request
import webbrowser

URL = "http://127.0.0.1:8765"


def main():
    try:
        with urllib.request.urlopen(URL + "/api/state", timeout=2) as response:
            if response.status == 200:
                webbrowser.open(URL)
                return
    except OSError:
        pass
    import server
    print("LearnNest 学习工作台已启动。关闭此窗口会停止自动更新。", flush=True)
    threading.Timer(1.2, lambda: webbrowser.open(URL)).start()
    server.main()


if __name__ == "__main__":
    main()
