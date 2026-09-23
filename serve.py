#!/usr/bin/env python3
"""Serve the prototype and relay two role-owned phones to one main screen.

Run: python serve.py

The main browser owns the game rules. Phones claim P1 or P2, receive snapshots,
and send role-scoped inputs. The relay retains inputs until acknowledged and
reserves disconnected seats for 30 seconds. Keep one service instance.

PORT defaults to 8080. PUBLIC_URL (or RENDER_EXTERNAL_URL) supplies the join
address. The host gets a private phone join link automatically; nobody types
a hosting password. Legacy SEAT_TOKEN settings are ignored. Hosted mode serves dist/;
local mode serves the working tree with no-cache headers.
"""
import os

import http.server
import socketserver
import json
import hashlib
import gzip
import re
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

# Each room owns its relay state. Only the registry lock is shared across rooms.
ROOMS = {}
ROOMS_LOCK = threading.Lock()
ROOM_IDLE_TTL = 30 * 60
MAX_ROOMS = 100
GUEST_GRACE = 30.0
INTENT_TTL = 10.0
HOST_GRACE = 30.0
HOST_REFRESH_DELAY = 4.0

P1_CALLS = {"ready", "restart", "act", "declineModule", "takePrize", "porteTap", "porteUndo", "porteClear",
            "porteSubmit", "coffreTap", "coffreUndo", "bureauTap", "bureauClear", "bureauSubmit", "bureauDoor", "clavierTap", "clavierClear", "clavierSubmit",
            "grilleTry", "deguisementSubmit", "ecouteCut", "fauxChoose", "tchatchePick"}
P2_CALLS = {"ready", "restart", "selectJob", "pullLever"}


class Room:
    def __init__(self, room_id):
        self.id = room_id
        self.lock = threading.RLock()
        self.epoch = uuid.uuid4().hex
        self.state = {"v": 0, "payload": None, "host": None, "seq": -1, "updated": 0.0}
        self.intents = []
        self.received = OrderedDict()
        self.seats = {role: {"client": None, "ticket": None, "seen": 0.0} for role in ("p1", "p2")}
        self.host = {"client": None, "secret": None, "page": None, "lease": None, "join": None, "seen": 0.0}
        self.diag_lock = threading.Lock()
        self.diag = {"requests": {}, "errors": {}, "events": deque(maxlen=100)}
        self.touched = time.monotonic()

    def record_event(self, kind):
        with self.diag_lock:
            self.diag["events"].append({"at": time.time(), "event": kind})

    def seat_age(self, role):
        seen = self.seats[role]["seen"]
        return time.monotonic() - seen if seen else None

    def seat_taken(self, role):
        age = self.seat_age(role)
        return self.seats[role]["client"] is not None and age is not None and age < GUEST_GRACE

    def presence(self):
        return {"seats": {role: {"taken": self.seat_taken(role), "age": self.seat_age(role)}
                          for role in self.seats}, "epoch": self.epoch}

    def owns_seat(self, role, client, ticket):
        seat = self.seats.get(role)
        return bool(seat and client and ticket and seat["client"] == client and seat["ticket"] == ticket)

    def phone_join_url(self):
        return JOIN_URL + "&" + urlencode({"room": self.id, "t": self.host["join"]}) if JOIN_URL and self.host["join"] else None


def find_room(room_id, create=False):
    with ROOMS_LOCK:
        now = time.monotonic()
        for key, room in list(ROOMS.items()):
            if now - room.touched > ROOM_IDLE_TTL and room.lock.acquire(blocking=False):
                try:
                    if now - room.touched > ROOM_IDLE_TTL:
                        del ROOMS[key]
                finally:
                    room.lock.release()
        if room_id not in ROOMS and create and len(ROOMS) < MAX_ROOMS:
            ROOMS[room_id] = Room(room_id)
        room = ROOMS.get(room_id)
        if room:
            room.touched = now
        return room


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
        path = urlsplit(self.path).path
        if HOSTED and path.startswith(("/art/", "/styles/", "/js/")):
            # SimpleHTTPRequestHandler answers conditional requests with 304.
            # Reuse unchanged artwork/fonts without caching live relay state.
            self.send_header("Cache-Control", "public, max-age=0, must-revalidate")
        else:
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
        room = getattr(self, 'room', None)
        if room:
            with room.diag_lock:
                room.diag["requests"][route] = room.diag["requests"].get(route, 0) + 1
                if code >= 400:
                    key = route + ":" + str(code)
                    room.diag["errors"][key] = room.diag["errors"].get(key, 0) + 1
        super().send_response(code, message)

    def _host(self):
        return bool(self.room.host["lease"] and self.headers.get("X-Host-Lease") == self.room.host["lease"])

    # ------------------------------------------------------------------ send
    def _json(self, obj, code=200):
        # Build the response while locked, but write it only after the handler
        # releases its room lock. A slow socket must not stall the other players.
        return obj, code

    def _send_json(self, obj, code):
        body = json.dumps(obj, separators=(',', ':')).encode("utf-8")
        compress = len(body) >= 1024 and any(
            part.strip() == 'gzip' for part in self.headers.get('Accept-Encoding', '').split(','))
        if compress:
            body = gzip.compress(body, compresslevel=1)
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Vary", "Accept-Encoding")
        if compress:
            self.send_header("Content-Encoding", "gzip")
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
        """A host lease or the automatically generated phone invitation."""
        allowed = self._host() or bool(self.room.host["join"] and self._query("t") == self.room.host["join"])
        if allowed:
            self.room.touched = time.monotonic()
        return allowed

    def _select_room(self, create=False):
        room_id = self._query('room')
        if not re.fullmatch(r'[A-Za-z0-9_-]{16,80}', room_id):
            self.send_error(400, 'missing or invalid room; scan a new QR code')
            return False
        self.room = find_room(room_id, create)
        if create and not self.room:
            self.send_error(503, 'all rooms are in use; try again later')
            return False
        return True

    # ------------------------------------------------------------------- GET
    def do_GET(self):
        result = self._get()
        if isinstance(result, tuple):
            self._send_json(*result)

    def _get(self):
        path = self.path.split("?", 1)[0]
        self.room = None  # A keep-alive connection may switch rooms or serve assets.
        if path.startswith('/link/') or path == '/qr.svg':
            if not self._select_room():
                return
            if not self.room:
                if path == '/link/status':
                    return self._json({"relay": True, "protocol": 7, "joinRequired": True, "hostReady": False,
                                       "seats": {role: {"taken": False, "age": None} for role in ('p1', 'p2')}})
                if path == '/link/state':
                    return self._json({"roomMissing": True})
                return self.send_error(404, 'room not active; keep the main screen open')

        # Discovery is public; only the active host receives the invitation.
        if path == "/link/status":
            with self.room.lock:
                out = {"relay": True, "protocol": 7, "joinRequired": not self._allowed(), **self.room.presence(),
                       "hostReady": bool(self.room.state["updated"] and time.monotonic() - self.room.state["updated"] < 5)}
                if self._host():
                    out["join"] = self.room.phone_join_url()
            return self._json(out)

        if path.startswith("/link/") and not self._allowed():
            return self.send_error(403, "no token")

        if path == "/link/state":
            try:
                since = int(self._query("since") or 0)
            except ValueError:
                since = 0
            with self.room.lock:
                role = self._query("role")
                if not self.room.owns_seat(role, self._query("client"), self._query("ticket")):
                    return self._json({"seatLost": True, "epoch": self.room.epoch})
                self.room.seats[role]["seen"] = time.monotonic()
                out = {"v": self.room.state["v"], "epoch": self.room.epoch,
                       "hostAge": time.monotonic() - self.room.state["updated"] if self.room.state["updated"] else None}
                # An epoch change recovers immediately even if since is higher
                # than this process's version counter.
                if self.room.state["payload"] is not None and (self.room.state["v"] != since or self._query("epoch") != self.room.epoch):
                    out["payload"] = self.room.state["payload"]
            return self._json(out)

        if path == "/link/intent":
            with self.room.lock:
                if not self._host():
                    return self._json({"error": "host required"}, 403)
                now = time.monotonic()
                self.room.intents[:] = [m for m in self.room.intents if now - m["received"] < INTENT_TTL]
                # Reading is not acknowledging: a lost HTTP response must not
                # delete a tap before the presenter has applied it.
                out = {"intents": list(self.room.intents), **self.room.presence()}
            return self._json(out)

        if path == "/link/diagnostics":
            with self.room.lock:
                if not self._host() and not self.room.owns_seat(self._query('role'), self._query('client'), self._query('ticket')):
                    return self._json({"error": "active player required"}, 403)
                out = {"protocol": 7, "queuedInputs": len(self.room.intents),
                       "hostAge": time.monotonic() - self.room.host["seen"], "seats": self.room.presence()["seats"]}
            with self.room.diag_lock:
                out.update(requests=dict(self.room.diag["requests"]), errors=dict(self.room.diag["errors"]), events=list(self.room.diag["events"]))
            return self._json(out)

        if path == "/qr.svg":
            with self.room.lock:
                if not self._allowed():
                    return self.send_error(403, "invitation required")
                invitation_url = self.room.phone_join_url()
            try:
                import io as _io
                import segno
                # a STANDALONE svg document, not svg_inline(): an <img> needs the
                # xmlns and the prolog, and the inline form omits both because it
                # is meant to be pasted into a page that already has them.
                buf = _io.BytesIO()
                segno.make(invitation_url, error="m").save(
                    buf, kind="svg", scale=8, border=4, dark="#111111", light="#ffffff")
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
        result = self._post()
        if isinstance(result, tuple):
            self._send_json(*result)

    def _post(self):
        path = self.path.split("?", 1)[0]
        self.room = None
        if not path.startswith('/link/'):
            return self.send_error(404, 'no such endpoint')
        msg = None
        if path == '/link/host':
            msg = self._read()
            if not isinstance(msg, dict) or any(not isinstance(msg.get(k), str) or not 16 <= len(msg[k]) <= 120
                                                for k in ('client', 'secret', 'page')):
                return self._json({"error": "invalid host"}, 400)
        if not self._select_room(create=path == '/link/host'):
            return
        if not self.room:
            return self.send_error(404, 'room not active; keep the main screen open')

        if path.startswith("/link/") and path != "/link/host" and not self._allowed():
            return self.send_error(403, "no token")

        if path == "/link/host":
            with self.room.lock:
                now = time.monotonic()
                same = self.room.host["client"] == msg["client"] and self.room.host["secret"] == msg["secret"]
                resume = msg.get("resume")
                # The leaving page writes this proof to its own sessionStorage
                # on pagehide. Ordinary duplicate tabs do not inherit it.
                handoff = (same and isinstance(resume, dict) and self.room.host["lease"]
                           and resume.get("lease") == self.room.host["lease"]
                           and resume.get("page") == self.room.host["page"])
                if self.room.host["client"] and not same and now - self.room.host["seen"] < HOST_GRACE:
                    return self._json({"error": "another screen is hosting"}, 409)
                if same and self.room.host["page"] != msg["page"] and not handoff and now - self.room.host["seen"] < HOST_REFRESH_DELAY:
                    return self._json({"error": "waiting for previous page"}, 409)
                if not same:
                    self.room.state.update(v=0, payload=None, host=None, seq=-1, updated=0)
                    self.room.intents.clear()
                    self.room.received.clear()
                    for seat in self.room.seats.values():
                        seat.update(client=None, ticket=None, seen=0.0)
                if not same or self.room.host["page"] != msg["page"]:
                    self.room.host["lease"] = uuid.uuid4().hex
                    self.room.record_event("host_resumed" if same else "host_claimed")
                # Stable for this host across refreshes and relay restarts, but
                # grants no presenter privileges and changes with a new host.
                invitation = hashlib.sha256(("phone-join:" + self.room.id + ":" + msg["secret"]).encode()).hexdigest()
                self.room.host.update(client=msg["client"], secret=msg["secret"], page=msg["page"], seen=now, join=invitation)
                self.room.touched = now
                # Ownership secret never travels in the public game snapshot.
                return self._json({"lease": self.room.host["lease"], "epoch": self.room.epoch, "join": self.room.phone_join_url()})

        if path == "/link/claim":
            msg = self._read()
            if not isinstance(msg, dict):
                return self._json({"error": "invalid claim"}, 400)
            role, client = msg.get("role"), msg.get("client")
            if role not in self.room.seats or not isinstance(client, str) or not 1 <= len(client) <= 120:
                return self._json({"error": "invalid role"}, 400)
            with self.room.lock:
                if not self.room.state["updated"] or time.monotonic() - self.room.state["updated"] > 5:
                    return self._json({"error": "waiting for presenter"}, 425)
                if self.room.seat_taken(role) and self.room.seats[role]["client"] != client:
                    return self._json({"error": "role taken"}, 409)
                if any(self.room.seat_taken(other) and self.room.seats[other]["client"] == client
                       for other in self.room.seats if other != role):
                    return self._json({"error": "already joined"}, 409)
                seat = self.room.seats[role]
                if seat["client"] != client or not seat["ticket"]:
                    seat.update(client=client, ticket=uuid.uuid4().hex)
                    self.room.record_event("seat_claimed_" + role)
                seat["seen"] = time.monotonic()
                return self._json({"role": role, "ticket": seat["ticket"], "epoch": self.room.epoch})

        if path == "/link/release":
            msg = self._read()
            if not isinstance(msg, dict):
                return self._json({"error": "invalid release"}, 400)
            role = msg.get("role")
            if role not in self.room.seats:
                return self._json({"error": "invalid role"}, 400)
            with self.room.lock:
                if not self._host() and not self.room.owns_seat(role, msg.get("client"), msg.get("ticket")):
                    return self._json({"error": "role owner required"}, 403)
                self.room.seats[role].update(client=None, ticket=None, seen=0.0)
                self.room.record_event("seat_released_" + role)
                self.room.intents[:] = [m for m in self.room.intents if m["role"] != role]
            return self._json({"ok": True, **self.room.presence()})

        if path == "/link/state":
            payload = self._read()
            if (not isinstance(payload, dict) or not isinstance(payload.get("S"), dict)
                    or not isinstance(payload.get("session"), str)
                    or not isinstance(payload.get("host"), str)
                    or not isinstance(payload.get("seq"), int)):
                return self._json({"error": "invalid state"}, 400)
            with self.room.lock:
                if not self._host() or payload["host"] != self.room.host["client"]:
                    return self._json({"error": "host required"}, 403)
                self.room.host["seen"] = time.monotonic()
                # Timed-out requests may still reach the server. An older state
                # from the same presenter must never replace a newer one.
                if payload["host"] != self.room.state["host"] or payload["seq"] > self.room.state["seq"]:
                    old_session = (self.room.state["payload"] or {}).get("session")
                    if old_session != payload["session"]:
                        self.room.intents.clear()
                        self.room.received.clear()
                    self.room.state.update(v=self.room.state["v"] + 1, payload=payload,
                                 host=payload["host"], seq=payload["seq"], updated=time.monotonic())
                out = {"ok": True, "v": self.room.state["v"], **self.room.presence()}
            return self._json(out)

        if path == "/link/ack":
            msg = self._read()
            if not isinstance(msg, dict) or not isinstance(msg.get("ids"), list):
                return self._json({"error": "invalid acknowledgement"}, 400)
            ids = {item for item in msg["ids"] if isinstance(item, str)}
            with self.room.lock:
                if not self._host():
                    return self._json({"error": "host required"}, 403)
                if msg.get("session") == (self.room.state["payload"] or {}).get("session"):
                    self.room.intents[:] = [m for m in self.room.intents if m["id"] not in ids]
            return self._json({"ok": True})

        if path == "/link/intent":
            msg = self._read()
            if (not isinstance(msg, dict) or not isinstance(msg.get("id"), str)
                    or not 1 <= len(msg["id"]) <= 120 or not isinstance(msg.get("call"), str)
                    or not isinstance(msg.get("args"), list)):
                return self._json({"error": "invalid intent"}, 400)
            with self.room.lock:
                role = msg.get("role")
                if not self.room.owns_seat(role, msg.get("client"), msg.get("ticket")):
                    return self._json({"error": "seat lost"}, 410)
                allowed = P1_CALLS if role == "p1" else P2_CALLS
                if msg["call"] not in allowed:
                    return self._json({"error": "wrong role"}, 403)
                self.room.seats[role]["seen"] = time.monotonic()
                if not self.room.state["payload"] or msg.get("session") != self.room.state["payload"].get("session"):
                    return self._json({"error": "resync", "epoch": self.room.epoch}, 409)
                if msg["id"] in self.room.received:
                    return self._json({"ok": True, "duplicate": True})
                now = time.monotonic()
                self.room.intents[:] = [m for m in self.room.intents if now - m["received"] < INTENT_TTL]
                if len(self.room.intents) >= 64:
                    return self._json({"error": "busy"}, 503)
                self.room.intents.append({"id": msg["id"], "session": msg["session"],
                                "role": role, "call": msg["call"],
                                "args": [role] if msg["call"] == "ready" else msg["args"], "received": now})
                self.room.received[msg["id"]] = True
                while len(self.room.received) > 512:
                    self.room.received.popitem(last=False)
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

    JOIN_URL = base + "/?" + urlencode({"join": "1"})

    with Threaded(("0.0.0.0", PORT), Handler) as httpd:
        if HOSTED:
            print("prototype build on %s  (port %d)" % (base, PORT))
        else:
            print("prototype   ->  http://127.0.0.1:%d/index.html" % PORT)
        print("join phones ->  open CONNECT PHONES on the main screen for its QR code")
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
