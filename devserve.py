#!/usr/bin/env python3
"""手元の確認用サーバー。**控えを効かせないで配る。**

素の http.server は Last-Modified しか返さないので、ブラウザが勝手に
控えを使い、直したはずの窓が古いまま出る（2026-09-12 に実際そうなった）。
配るものが小さいので、毎回取り直させる。
"""
import functools
import http.server
import pathlib
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8797


HERE = pathlib.Path(__file__).resolve().parent


class H(http.server.SimpleHTTPRequestHandler):
    # どこから起こされても、この台本と同じ所を配る
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *a):
        pass            # 静かに


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(H, directory=str(HERE))
    with socketserver.TCPServer(("127.0.0.1", PORT), handler) as s:
        print(f"壁の盤（確認用・控えなし） → http://127.0.0.1:{PORT}", flush=True)
        s.serve_forever()
