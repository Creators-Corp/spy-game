#!/usr/bin/env python3
"""Serve the prototype and relay two role-owned phones to one main screen.

Run: python serve.py

The main browser owns the game rules. Phones claim P1 or P2, receive snapshots,
and send role-scoped inputs. The relay retains inputs until acknowledged and
reserves disconnected seats for 30 seconds. Keep one service instance.

PORT defaults to 8080. PUBLIC_URL (or RENDER_EXTERNAL_URL) supplies the join
address. SEAT_TOKEN, when set, is entered on the main screen and included in
its QR code so neither phone has to type it. Hosted mode serves dist/;
local mode serves the working tree with no-cache headers.
"""
import os

import http.server
import socketserver
import json
import socket
import sys
import threading
import time
import uuid
from collections import OrderedDict, deque
from urllib.parse import parse_qs, urlsplit, urlencode

PORT = int(os.environ.get("PORT") or 8080)
# Render sets RENDER, and sets RENDER_EXTERNAL_URL to the public address
HOSTED = bool(os.environ.get("RENDER") or os.environ.get("PUBLIC_URL"))
PUBLIC_URL = (os.environ.get("PUBLIC_URL")
              or os.environ.get("RENDER_EXTERNAL_URL") or "").rstrip("/")
SEAT_TOKEN = os.environ.get("SEAT_TOKEN") or ""

# ------------------------------------------------------------------ le relais
# Two role-owned phones, one presenter, everything in memory, nothing on disk. A version
# number on the state so a guest that has seen the latest gets told "nothing
# new" instead of the whole screen again.
LOCK = threading.Lock()
EPOCH = uuid.uuid4().hex              # a new relay process starts a new version history
STATE = {"v": 0, "payload": None, "host": None, "seq": -1, "updated": 0.0}
INTENTS = []
RECEIVED = OrderedDict()             # deduplicate a phone retry after a lost response
SEATS = {role: {"client": None, "ticket": None, "seen": 0.0} for role in ("p1", "p2")}
GUEST_GRACE = 30.0                   # tolerate a short mobile network interruption
INTENT_TTL = 10.0                    # never replay old movement after a long outage
HOST = {"client": None, "secret": None, "page": None, "lease": None, "seen": 0.0}
HOST_GRACE = 30.0
HOST_REFRESH_DELAY = 4.0
DIAG_LOCK = threading.Lock()
DIAG = {"requests": {}, "errors": {}, "events": deque(maxlen=100)}


def record_event(kind):
    # Deliberately omit URLs, credentials, client IDs and game contents.
    with DIAG_LOCK:
        DIAG["events"].append({"at": time.time(), "event": kind})


P1_CALLS = {"ready", "restart", "act", "declineModule", "takePrize", "porteTap", "porteUndo",
            "porteSubmit", "coffreTap", "coffreUndo", "bureauSubmit", "bureauDoor", "clavierSubmit",
            "grilleTry", "deguisementSubmit", "ecouteCut", "fauxChoose", "tchatchePick"}
P2_CALLS = {"ready", "restart", "selectJob", "pullLever"}


def seat_age(role):
    seen = SEATS[role]["seen"]
    return time.monotonic() - seen if seen else None


def seat_taken(role):
    age = seat_age(role)
    return SEATS[role]["client"] is not None and age is not None and age < GUEST_GRACE


def presence():
    return {"seats": {role: {"taken": seat_taken(role), "age": seat_age(role)}
                      for role in SEATS}, "epoch": EPOCH}


def owns_seat(role, client, ticket):
    seat = SEATS.get(role)
    return bool(seat and client and ticket and seat["client"] == client and seat["ticket"] == ticket)



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
    protocol_version = "HTTP/1.1"     # reuse connections for the frequent small polls
    timeout = 15                    # release idle keep-alive sockets

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # only complain about real problems; a 200 per asset is just noise, and
        # the relay polls several times a second
        if len(args) > 1 and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("  HTTP %s\n" % args[1])

    def send_response(self, code, message=None):
        route = urlsplit(self.path).path
        route = route if route in ("/link/host", "/link/status", "/link/state", "/link/claim",
                                  "/link/release", "/link/intent", "/link/ack", "/link/diagnostics") else "assets"
        with DIAG_LOCK:
            DIAG["requests"][route] = DIAG["requests"].get(route, 0) + 1
            if code >= 400:
                key = route + ":" + str(code)
                DIAG["errors"][key] = DIAG["errors"].get(key, 0) + 1
        super().send_response(code, message)

    def _host(self):
        return bool(HOST["lease"] and self.headers.get("X-Host-Lease") == HOST["lease"])

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
        return parse_qs(urlsplit(self.path).query).get(key, [""])[0]

    def _allowed(self):
        """The optional hosting token is shared through the main screen’s QR code."""
        return not SEAT_TOKEN or self._query("t") == SEAT_TOKEN

    # ------------------------------------------------------------------- GET
    def do_GET(self):
        path = self.path.split("?", 1)[0]

        # ASKING IS FREE, BEING TOLD IS NOT. /link/status has to answer without
        # a token or the presenter's page decides there is no relay and hides
        # the button that would have let them supply one. It gives away only
        # that a relay exists and whether a seat is taken; the join address,
        # which carries the token, is held back until the token is supplied.
        if path == "/link/status":
            ok = self._allowed()
            out = {"relay": True, "protocol": 4, "needsToken": bool(SEAT_TOKEN) and not ok, **presence()}
            if ok:
                out["join"] = JOIN_URL
                out["hostReady"] = bool(STATE["updated"] and time.monotonic() - STATE["updated"] < 5)
            return self._json(out)

        if path.startswith("/link/") and not self._allowed():
            return self.send_error(403, "no token")

        if path == "/link/state":
            try:
                since = int(self._query("since") or 0)
            except ValueError:
                since = 0
            with LOCK:
                role = self._query("role")
                if not owns_seat(role, self._query("client"), self._query("ticket")):
                    return self._json({"seatLost": True, "epoch": EPOCH})
                SEATS[role]["seen"] = time.monotonic()
                out = {"v": STATE["v"], "epoch": EPOCH,
                       "hostAge": time.monotonic() - STATE["updated"] if STATE["updated"] else None}
                # An epoch change recovers immediately even if since is higher
                # than this process's version counter.
                if STATE["payload"] is not None and (STATE["v"] != since or self._query("epoch") != EPOCH):
                    out["payload"] = STATE["payload"]
            return self._json(out)

        if path == "/link/intent":
            with LOCK:
                if not self._host():
                    return self._json({"error": "host required"}, 403)
                now = time.monotonic()
                INTENTS[:] = [m for m in INTENTS if now - m["received"] < INTENT_TTL]
                # Reading is not acknowledging: a lost HTTP response must not
                # delete a tap before the presenter has applied it.
                out = {"intents": list(INTENTS), **presence()}
            return self._json(out)

        if path == "/link/diagnostics":
            with LOCK:
                if not self._host():
                    return self._json({"error": "host required"}, 403)
                out = {"protocol": 4, "queuedInputs": len(INTENTS),
                       "hostAge": time.monotonic() - HOST["seen"], "seats": presence()["seats"]}
            with DIAG_LOCK:
                out.update(requests=dict(DIAG["requests"]), errors=dict(DIAG["errors"]), events=list(DIAG["events"]))
            return self._json(out)

        if path == "/qr.svg":
            if not self._allowed():
                return self.send_error(403, "no token")
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

        if path.startswith("/link/") and not self._allowed():
            return self.send_error(403, "no token")

        if path == "/link/host":
            msg = self._read()
            if not isinstance(msg, dict) or any(not isinstance(msg.get(k), str) or not 16 <= len(msg[k]) <= 120
                                                for k in ("client", "secret", "page")):
                return self._json({"error": "invalid host"}, 400)
            with LOCK:
                now = time.monotonic()
                same = HOST["client"] == msg["client"] and HOST["secret"] == msg["secret"]
                if HOST["client"] and not same and now - HOST["seen"] < HOST_GRACE:
                    return self._json({"error": "another screen is hosting"}, 409)
                if same and HOST["page"] != msg["page"] and now - HOST["seen"] < HOST_REFRESH_DELAY:
                    return self._json({"error": "waiting for previous page"}, 409)
                if not same:
                    STATE.update(v=0, payload=None, host=None, seq=-1, updated=0)
                    INTENTS.clear()
                    RECEIVED.clear()
                    for seat in SEATS.values():
                        seat.update(client=None, ticket=None, seen=0.0)
                if not same or HOST["page"] != msg["page"]:
                    HOST["lease"] = uuid.uuid4().hex
                    record_event("host_resumed" if same else "host_claimed")
                HOST.update(client=msg["client"], secret=msg["secret"], page=msg["page"], seen=now)
                # Ownership secret never travels in the public game snapshot.
                return self._json({"lease": HOST["lease"], "epoch": EPOCH})

        if path == "/link/claim":
            msg = self._read()
            if not isinstance(msg, dict):
                return self._json({"error": "invalid claim"}, 400)
            role, client = msg.get("role"), msg.get("client")
            if role not in SEATS or not isinstance(client, str) or not 1 <= len(client) <= 120:
                return self._json({"error": "invalid role"}, 400)
            with LOCK:
                if not STATE["updated"] or time.monotonic() - STATE["updated"] > 5:
                    return self._json({"error": "waiting for presenter"}, 425)
                if seat_taken(role) and SEATS[role]["client"] != client:
                    return self._json({"error": "role taken"}, 409)
                if any(seat_taken(other) and SEATS[other]["client"] == client
                       for other in SEATS if other != role):
                    return self._json({"error": "already joined"}, 409)
                seat = SEATS[role]
                if seat["client"] != client or not seat["ticket"]:
                    seat.update(client=client, ticket=uuid.uuid4().hex)
                    record_event("seat_claimed_" + role)
                seat["seen"] = time.monotonic()
                return self._json({"role": role, "ticket": seat["ticket"], "epoch": EPOCH})

        if path == "/link/release":
            msg = self._read()
            if not isinstance(msg, dict):
                return self._json({"error": "invalid release"}, 400)
            role = msg.get("role")
            if role not in SEATS:
                return self._json({"error": "invalid role"}, 400)
            with LOCK:
                if not self._host() and not owns_seat(role, msg.get("client"), msg.get("ticket")):
                    return self._json({"error": "role owner required"}, 403)
                SEATS[role].update(client=None, ticket=None, seen=0.0)
                record_event("seat_released_" + role)
                INTENTS[:] = [m for m in INTENTS if m["role"] != role]
            return self._json({"ok": True, **presence()})

        if path == "/link/state":
            payload = self._read()
            if (not isinstance(payload, dict) or not isinstance(payload.get("S"), dict)
                    or not isinstance(payload.get("session"), str)
                    or not isinstance(payload.get("host"), str)
                    or not isinstance(payload.get("seq"), int)):
                return self._json({"error": "invalid state"}, 400)
            with LOCK:
                if not self._host() or payload["host"] != HOST["client"]:
                    return self._json({"error": "host required"}, 403)
                # Timed-out requests may still reach the server. An older state
                # from the same presenter must never replace a newer one.
                if payload["host"] != STATE["host"] or payload["seq"] > STATE["seq"]:
                    old_session = (STATE["payload"] or {}).get("session")
                    if old_session != payload["session"]:
                        INTENTS.clear()
                        RECEIVED.clear()
                    STATE.update(v=STATE["v"] + 1, payload=payload,
                                 host=payload["host"], seq=payload["seq"], updated=time.monotonic())
                out = {"ok": True, "v": STATE["v"], **presence()}
            return self._json(out)

        if path == "/link/ack":
            msg = self._read()
            if not isinstance(msg, dict) or not isinstance(msg.get("ids"), list):
                return self._json({"error": "invalid acknowledgement"}, 400)
            ids = {item for item in msg["ids"] if isinstance(item, str)}
            with LOCK:
                if not self._host():
                    return self._json({"error": "host required"}, 403)
                if msg.get("session") == (STATE["payload"] or {}).get("session"):
                    INTENTS[:] = [m for m in INTENTS if m["id"] not in ids]
            return self._json({"ok": True})

        if path == "/link/intent":
            msg = self._read()
            if (not isinstance(msg, dict) or not isinstance(msg.get("id"), str)
                    or not 1 <= len(msg["id"]) <= 120 or not isinstance(msg.get("call"), str)
                    or not isinstance(msg.get("args"), list)):
                return self._json({"error": "invalid intent"}, 400)
            with LOCK:
                role = msg.get("role")
                if not owns_seat(role, msg.get("client"), msg.get("ticket")):
                    return self._json({"error": "seat lost"}, 410)
                allowed = P1_CALLS if role == "p1" else P2_CALLS
                if msg["call"] not in allowed:
                    return self._json({"error": "wrong role"}, 403)
                SEATS[role]["seen"] = time.monotonic()
                if not STATE["payload"] or msg.get("session") != STATE["payload"].get("session"):
                    return self._json({"error": "resync", "epoch": EPOCH}, 409)
                if msg["id"] in RECEIVED:
                    return self._json({"ok": True, "duplicate": True})
                now = time.monotonic()
                INTENTS[:] = [m for m in INTENTS if now - m["received"] < INTENT_TTL]
                if len(INTENTS) >= 64:
                    return self._json({"error": "busy"}, 503)
                INTENTS.append({"id": msg["id"], "session": msg["session"],
                                "role": role, "call": msg["call"],
                                "args": [role] if msg["call"] == "ready" else msg["args"], "received": now})
                RECEIVED[msg["id"]] = True
                while len(RECEIVED) > 512:
                    RECEIVED.popitem(last=False)
            return self._json({"ok": True})

        return self.send_error(404, "no such endpoint")


class Threaded(socketserver.ThreadingMixIn, http.server.HTTPServer):
    """Threaded because the main screen and both phones poll concurrently; a single
    thread would make them queue behind each other."""
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 64          # phone asset loads must not crowd out relay requests


def main():
    global JOIN_URL
    root = os.path.dirname(os.path.abspath(__file__))

    if HOSTED:
        # Serve only the packaged site, excluding local tools and handouts.
        dist = os.path.join(root, "dist")
        if not os.path.isfile(os.path.join(dist, "index.html")):
            sys.stderr.write(
                "refusing to start: hosted, but dist/ is not built.\n"
                "  python tools/pack.py\n"
                "then restart the service.\n")
            raise SystemExit(2)
        os.chdir(dist)
        base = PUBLIC_URL or "http://0.0.0.0:%d" % PORT
    else:
        os.chdir(root)
        base = "http://%s:%d" % (lan_ip(), PORT)

    JOIN_URL = base + "/?" + urlencode({"join": "1", **({"t": SEAT_TOKEN} if SEAT_TOKEN else {})})

    with Threaded(("0.0.0.0", PORT), Handler) as httpd:
        if HOSTED:
            print("prototype build on %s  (port %d)" % (base, PORT))
        else:
            print("prototype   ->  http://127.0.0.1:%d/index.html" % PORT)
        print("join phones ->  %s" % JOIN_URL)
        if SEAT_TOKEN:
            print("               the relay needs that token; without it nobody joins")
        try:
            import segno  # noqa: F401
            print("               the same address is on screen as a QR code")
        except ImportError:
            print("               pip install segno for the on-screen QR code")
        if not HOSTED:
            print("no-cache, so a plain reload always picks up your edits")
        print("ctrl-c to stop")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
