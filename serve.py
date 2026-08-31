#!/usr/bin/env python3
"""Serve the prototype on http://127.0.0.1:8080 — always the same address.

    python serve.py

Why this exists rather than `python -m http.server`: the plain module lets the
browser cache js and css, so an edit can appear not to have happened and you
end up hunting a bug that is really a stale file. This sends no-store on
everything, which means a normal reload is always a real reload — and there is
never a reason to move to a different port.
"""
import http.server
import socketserver
import os
import sys

PORT = 8080


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # only complain about real problems; a 200 per asset is just noise
        if args and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("  %s %s\n" % (args[1], args[0]))


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", PORT), NoCache) as httpd:
        print("prototype  ->  http://127.0.0.1:%d/index.html" % PORT)
        print("no-cache, so a plain reload always picks up your edits")
        print("ctrl-c to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
