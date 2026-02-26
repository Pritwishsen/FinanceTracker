from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
import sys

PORT = 5000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            self.path = '/app-v3.html'
        return super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), Handler)
    print(f"Serving on port {PORT}", flush=True)
    server.serve_forever()
