import http.server
import socketserver
import os
import sys
import threading
import time

PORT = 5000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            self.path = '/app-v3.html'
        return super().do_GET()

    def send_head(self):
        # Deny any path with a dotfile/dot-directory segment (.git, .env, etc.).
        # This server has no allow-list of servable assets — without this, anything
        # under DIRECTORY with a predictable name is servable by path, including the
        # .git directory (full commit history) and any .env created for local use.
        # Overriding send_head() (rather than just do_GET) covers HEAD requests too,
        # since SimpleHTTPRequestHandler.do_HEAD calls send_head() directly.
        path_only = self.path.split('?', 1)[0]
        if any(seg.startswith('.') for seg in path_only.split('/') if seg):
            self.send_error(404, "File not found")
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        pass

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True

def keep_alive():
    while True:
        time.sleep(10)
        sys.stdout.write('')
        sys.stdout.flush()

if __name__ == '__main__':
    t = threading.Thread(target=keep_alive, daemon=True)
    t.start()
    server = ThreadedHTTPServer(('0.0.0.0', PORT), Handler)
    print(f"Serving on port {PORT}", flush=True)
    server.serve_forever()
