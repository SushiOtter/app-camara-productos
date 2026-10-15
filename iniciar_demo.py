"""Arranque robusto de Beauty Tech sin Node ni dependencias externas."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
import socket
import threading
import time
import webbrowser

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[HTTP] " + (fmt % args))

try:
    server = ThreadingHTTPServer(("127.0.0.1", 8000), QuietHandler)
except OSError:
    server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)

port = server.server_address[1]
url = f"http://127.0.0.1:{port}/"
print("=" * 58)
print(" BEAUTY TECH · DEMO LOCAL")
print("=" * 58)
print(f"Carpeta: {ROOT}")
print(f"Abre:    {url}")
print("Deja esta ventana abierta mientras utilizas la demo.")
print("Para detener el servidor, pulsa Ctrl+C.\n")
threading.Timer(0.8, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    print("\nCerrando el servidor de Beauty Tech...")
finally:
    server.server_close()
