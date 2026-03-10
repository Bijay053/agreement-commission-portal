#!/usr/bin/env python
import os
import sys
import subprocess
import signal
import time
import threading
from http.server import HTTPServer
from urllib.parse import urlparse
import http.client

DJANGO_PORT = 5001
VITE_PORT = 5173
PROXY_PORT = 5000

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_proxy(self):
        if self.path.startswith('/api/'):
            target_port = DJANGO_PORT
        else:
            target_port = VITE_PORT

        try:
            conn = http.client.HTTPConnection('127.0.0.1', target_port, timeout=30)

            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length) if content_length > 0 else None

            headers = {}
            for key, val in self.headers.items():
                if key.lower() not in ('host', 'transfer-encoding'):
                    headers[key] = val

            conn.request(self.command, self.path, body=body, headers=headers)
            resp = conn.getresponse()

            self.send_response(resp.status)
            for key, val in resp.getheaders():
                if key.lower() not in ('transfer-encoding',):
                    self.send_header(key, val)
            self.end_headers()

            while True:
                chunk = resp.read(8192)
                if not chunk:
                    break
                self.wfile.write(chunk)

            conn.close()
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(f'{{"message":"Backend unavailable: {str(e)}"}}'.encode())

    do_GET = do_proxy
    do_POST = do_proxy
    do_PUT = do_proxy
    do_PATCH = do_proxy
    do_DELETE = do_proxy
    do_OPTIONS = do_proxy
    do_HEAD = do_proxy


def start_django():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    from django.core.management import execute_from_command_line
    execute_from_command_line(['manage.py', 'runserver', f'0.0.0.0:{DJANGO_PORT}', '--noreload'])


def start_vite():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    subprocess.run(
        ['npx', 'vite', '--host', '0.0.0.0', '--port', str(VITE_PORT)],
        cwd=project_root,
        env={**os.environ, 'NODE_ENV': 'development'},
    )


def start_proxy():
    server = HTTPServer(('0.0.0.0', PROXY_PORT), ProxyHandler)
    print(f'Proxy server listening on port {PROXY_PORT}')
    server.serve_forever()


if __name__ == '__main__':
    django_thread = threading.Thread(target=start_django, daemon=True)
    vite_thread = threading.Thread(target=start_vite, daemon=True)

    django_thread.start()
    vite_thread.start()

    time.sleep(2)
    print(f'Django on :{DJANGO_PORT}, Vite on :{VITE_PORT}, Proxy on :{PROXY_PORT}')

    start_proxy()
