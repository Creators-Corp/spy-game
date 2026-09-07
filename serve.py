#!/usr/bin/env python3
"""Serve the prototype, and let one more person play from another computer.

    python serve.py

TWO JOBS, AND THE SECOND ONE IS ONLY FOR DEMOS.

The first is what it always was: hand the browser the files with no-store on
everything, so a plain reload is always a real reload and nobody spends an
afternoon hunting a bug that is really a cached script.

The second is LE RELAIS. The prototype fakes three devices on one screen, which
is fine in a room with one laptop and useless the moment somebody else wants to
actually play. So this also carries a handful of small messages between two
browsers: the presenter's page, which owns the game and runs Benjamin, and a
guest page on another machine, which is Assane and nothing else.

It is a RELAY, not a server: it holds no rules and decides nothing. The
presenter's browser is still the only place the game exists. All this does is
pass Assane's screen one way and his taps back the other, which is why it fits
in a page of standard library and why the game did not have to be rewritten to
get it.

    /link/state    the presenter puts Assane's screen here; the guest reads it
    /link/intent   the guest puts a tap here; the presenter reads it
    /link/status   is anybody there yet
    /qr.svg        the join address, for pointing a phone at

WHY IT BINDS TO EVERY INTERFACE. 127.0.0.1 is unreachable from the next desk,
which is the whole point of the exercise. That does mean anyone on the same
network can open it, so this is a demo tool and not a way to publish the
prototype — the sealed build in tools/pack.py is still the only thing that
should leave the building.
"""
import http.server
import socketserver
import json
import os
import socket
import sys
import threading
import time

PORT = 8080

# ------------------------------------------------------------------ le relais
# One guest, one presenter, everything in memory, nothing on disk. A version
# number on the state so a guest that has seen the latest gets told "nothing
# new" instead of the whole screen again.
LOCK = threading.Lock()
STATE = {"v": 0, "payload": None}      # presenter -> guest
INTENTS = []                           # guest -> presenter
SEEN = {"guest": 0.0}                  # when the guest last asked for anything


def guest_here():
    """A guest counts as present for a few seconds after its last poll, so a
    closed laptop hands the presenter back both halves rather than leaving
    Assane standing in a corridor."""
    return time.time() - SEEN["guest"] < 6.0


def lan_ip():
    """The address another machine can actually reach. Asking the routing table
    which interface would carry a packet outward is the only reliable way —
    a hostname lookup returns 127.0.0.1 as often as not."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


JOIN_URL = None          # filled in by main(), so the QR and the page agree


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # only complain about real problems; a 200 per asset is just noise, and
        # the relay polls several times a second
        if args and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("  %s %s\n" % (args[1], args[0]))

    # ------------------------------------------------------------------ send
    def _json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read(self):
        n = int(self.headers.get("Content-Length") or 0)
        if not n:
            return {}
        try:
            return json.loads(self.rfile.read(n).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}

    def _query(self, key):
        if "?" not in self.path:
            return ""
        for bit in self.path.split("?", 1)[1].split("&"):
            if bit.startswith(key + "="):
                return bit[len(key) + 1:]
        return ""

    # ------------------------------------------------------------------- GET
    def do_GET(self):
        path = self.path.split("?", 1)[0]

        if path == "/link/status":
            return self._json({"relay": True, "guest": guest_here(), "join": JOIN_URL})

        if path == "/link/state":
            SEEN["guest"] = time.time()
            try:
                since = int(self._query("since") or 0)
            except ValueError:
                since = 0
            with LOCK:
                if STATE["v"] > since and STATE["payload"] is not None:
                    return self._json({"v": STATE["v"], "payload": STATE["payload"]})
                return self._json({"v": STATE["v"]})

        if path == "/link/intent":
            with LOCK:
                out = list(INTENTS)
                del INTENTS[:]
            return self._json({"intents": out, "guest": guest_here()})

        if path == "/qr.svg":
            try:
                import io as _io
                import segno
                # a STANDALONE svg document, not svg_inline(): an <img> needs the
                # xmlns and the prolog, and the inline form omits both because it
                # is meant to be pasted into a page that already has them.
                buf = _io.BytesIO()
                segno.make(JOIN_URL, error="m").save(
                    buf, kind="svg", scale=8, border=2, dark="#111111", light="#ffffff")
                body = buf.getvalue()
            except Exception:
                return self.send_error(404, "no qr")
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            return self.wfile.write(body)

        return super().do_GET()

    # ------------------------------------------------------------------ POST
    def do_POST(self):
        path = self.path.split("?", 1)[0]

        if path == "/link/state":
            payload = self._read()
            with LOCK:
                STATE["v"] += 1
                STATE["payload"] = payload
            return self._json({"ok": True, "v": STATE["v"], "guest": guest_here()})

        if path == "/link/intent":
            SEEN["guest"] = time.time()
            msg = self._read()
            with LOCK:
                if len(INTENTS) < 64:       # a guest that spams cannot grow this
                    INTENTS.append(msg)
            return self._json({"ok": True})

        return self.send_error(404, "no such endpoint")


class Threaded(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """Threaded because two browsers poll this at the same time and a single
    thread would make them queue behind each other."""
    daemon_threads = True
    allow_reuse_address = True


def main():
    global JOIN_URL
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    ip = lan_ip()
    JOIN_URL = "http://%s:%d/?role=p1" % (ip, PORT)

    with Threaded(("0.0.0.0", PORT), Handler) as httpd:
        print("prototype   ->  http://127.0.0.1:%d/index.html" % PORT)
        print("second seat ->  %s" % JOIN_URL)
        try:
            import segno  # noqa: F401
            print("               the same address is on screen as a QR code")
        except ImportError:
            print("               pip install segno for the on-screen QR code")
        print("no-cache, so a plain reload always picks up your edits")
        print("ctrl-c to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
