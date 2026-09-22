import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from demo_sdk.utility.fetcher import _default_http_fetch, _session


seen = []


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_GET(self):
        seen.append((self.headers.get("Authorization"),
                     self.headers.get("Cookie"), self.client_address))
        self.send_response(200)
        self.send_header("Content-Length", "2")
        self.send_header("Set-Cookie", "session=account-A; Path=/")
        self.end_headers()
        self.wfile.write(b"{}")

    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
try:
    url = "http://127.0.0.1:%d/" % server.server_port
    for headers in [
        {"Authorization": "Bearer A"},
        {"Authorization": "Bearer B"},
        {"Cookie": "explicit=caller"},
        {},
    ]:
        response, error = _default_http_fetch(url, {"headers": headers, "timeout": 5})
        assert error is None, error
        assert response["status"] == 200, response

    assert [row[1] for row in seen] == [None, None, "explicit=caller", None], seen
    assert len({row[2] for row in seen}) == 1, "connection was not reused: %r" % seen
    print("cookies: isolated; connection: reused")
finally:
    _session().close()
    server.shutdown()
    server.server_close()
    thread.join(timeout=5)
