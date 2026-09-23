"""Relay regressions. Run: python -m unittest discover -s tools -p test_relay.py"""
import http.client
import json
from pathlib import Path
import sys
import threading
import time
import unittest
from unittest.mock import patch
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import serve


class RelayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = serve.Threaded(("127.0.0.1", 0), serve.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        serve.EPOCH = "relay-a"
        serve.STATE.update(v=0, payload=None, host=None, seq=-1, updated=0)
        for seat in serve.SEATS.values():
            seat.update(client=None, ticket=None, seen=0)
        self.tickets = {}
        serve.INTENTS.clear()
        serve.RECEIVED.clear()
        serve.HOST.update(client=None, secret=None, page=None, lease=None, join=None, seen=0)
        serve.JOIN_URL = 'http://localhost:8080/?join=1'
        self.host = {"client": "presenter-123456789", "secret": "secret-123456789012", "page": "page-12345678901234"}
        self.lease = None
        self.lease = self.request('/link/host', self.host)[1]['lease']

    def request(self, path, body=None, lease=True, invitation=True):
        if invitation and serve.HOST['join']:
            path += ('&' if '?' in path else '?') + urlencode({'t': serve.HOST['join']})
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        try:
            conn.request("GET" if body is None else "POST", path,
                         body=None if body is None else json.dumps(body),
                         headers={"Content-Type": "application/json", "X-Host-Lease": (self.lease or '') if lease is True else (lease or '')})
            response = conn.getresponse()
            raw = response.read()
            return response.status, json.loads(raw) if raw.startswith(b"{") else raw
        finally:
            conn.close()

    def state(self, seq=1, session="run-a"):
        return self.request("/link/state", {"host": self.host['client'], "seq": seq,
                            "session": session, "job": 0, "seed": 1234, "S": {"turn": seq}})

    def claim(self, role="p1", client="phone"):
        status, result = self.request("/link/claim", {"role": role, "client": client})
        if status == 200:
            self.tickets[(role, client)] = result["ticket"]
        return status, result

    def tap(self, ident="phone:1", session="run-a", role="p1", client="phone", call="act"):
        if (role, client) not in self.tickets:
            self.claim(role, client)
        return self.request("/link/intent", {"id": ident, "session": session,
                            "call": call, "args": [0, 1], "role": role, "client": client,
                            "ticket": self.tickets.get((role, client))})

    def test_guest_keeps_seat_through_short_mobile_interruption(self):
        serve.SEATS["p1"].update(client="phone", seen=time.monotonic() - 12)
        self.assertTrue(serve.seat_taken("p1"))
        serve.SEATS["p1"]["seen"] -= 20
        self.assertFalse(serve.seat_taken("p1"))

    def test_lost_post_response_can_retry_without_duplicate_tap(self):
        self.state()
        self.assertEqual(self.tap()[0], 200)
        self.assertTrue(self.tap()[1]["duplicate"])
        self.assertEqual(len(serve.INTENTS), 1)

    def test_lost_poll_response_keeps_taps_until_ack(self):
        self.state()
        self.tap()
        for _ in range(2):
            self.assertEqual(len(self.request("/link/intent")[1]["intents"]), 1)
        self.request("/link/ack", {"session": "run-a", "ids": ["phone:1"]})
        self.assertEqual(self.request("/link/intent")[1]["intents"], [])
        self.assertTrue(self.tap()[1]["duplicate"])
        self.assertEqual(serve.INTENTS, [])

    def test_new_run_discards_old_taps_even_with_same_job_and_seed(self):
        self.state()
        self.tap()
        self.state(2, "run-b")
        self.assertEqual(serve.INTENTS, [])
        self.assertEqual(self.tap()[0], 409)

    def test_old_ack_cannot_remove_new_run_input(self):
        self.state(session="run-b")
        self.tap(session="run-b")
        self.request("/link/ack", {"session": "run-a", "ids": ["phone:1"]})
        self.assertEqual(len(serve.INTENTS), 1)

    def test_restart_epoch_sends_state_despite_equal_or_higher_version(self):
        self.state()
        self.claim()
        auth = "&" + urlencode({"role": "p1", "client": "phone", "ticket": self.tickets[("p1", "phone")]})
        for version in (1, 999):
            data = self.request(("/link/state?since=%d&epoch=old-relay" % version) + auth)[1]
            self.assertIn("payload", data)
            self.assertEqual(data["epoch"], "relay-a")
        unchanged = self.request("/link/state?since=1&epoch=relay-a" + auth)[1]
        self.assertNotIn("payload", unchanged)
        self.assertIsNotNone(unchanged["hostAge"])

    def test_delayed_state_cannot_rewind_presenter(self):
        self.state(5)
        self.state(3)
        self.assertEqual(serve.STATE["payload"]["S"]["turn"], 5)
        self.assertEqual(serve.STATE["v"], 1)

    def test_state_publication_renews_host_without_another_claim(self):
        serve.HOST['seen'] -= 31
        self.assertEqual(self.state()[0], 200)
        other = dict(self.host, client='other-presenter-123456', secret='other-secret-123456')
        self.assertEqual(self.request('/link/host', other, lease=False)[0], 409)

    def test_door_clear_is_ordered_between_digits_and_retries_are_deduplicated(self):
        self.state()
        for ident, call in [('digit-1', 'porteTap'), ('clear', 'porteClear'), ('digit-2', 'porteTap')]:
            self.assertEqual(self.tap(ident=ident, call=call)[0], 200)
        self.tap(ident='clear', call='porteClear')
        pending = self.request('/link/intent')[1]['intents']
        self.assertEqual([m['id'] for m in pending], ['digit-1', 'clear', 'digit-2'])
        self.assertEqual(self.tap(ident='wrong-role', call='porteClear', role='p2', client='second-phone')[0], 403)

    def test_expired_movements_are_not_replayed(self):
        self.state()
        self.tap()
        serve.INTENTS[0]["received"] -= 11
        self.assertEqual(self.request("/link/intent")[1]["intents"], [])

    def test_queue_full_is_an_error_instead_of_silent_loss(self):
        self.state()
        for i in range(64):
            self.assertEqual(self.tap("phone:%d" % i)[0], 200)
        self.assertEqual(self.tap("overflow")[0], 503)

    def test_invitation_is_private_and_only_qr_guests_can_claim(self):
        self.state()
        status = self.request('/link/status', lease=False, invitation=False)[1]
        self.assertTrue(status['joinRequired'])
        self.assertNotIn('join', status)
        self.assertEqual(self.request('/link/claim', {'role': 'p1', 'client': 'phone'}, lease=False, invitation=False)[0], 403)
        self.assertEqual(self.request('/link/claim', {'role': 'p1', 'client': 'phone'}, lease=False)[0], 200)
        join = self.request('/link/status')[1]['join']
        self.assertIn(serve.HOST['join'], join)
        self.assertNotIn(self.host['secret'], join)
        self.assertNotIn(self.lease, join)

    def test_host_gets_join_code_without_legacy_hosting_password(self):
        from unittest.mock import patch
        with patch.dict(serve.os.environ, {'SEAT_TOKEN': 'old-render-password'}):
            status, response = self.request('/link/host', self.host, lease=False, invitation=False)
        self.assertEqual(status, 200)
        self.assertIn('?join=1&t=', response['join'])
        self.assertNotIn('old-render-password', response['join'])

    def test_same_host_invitation_survives_server_restart(self):
        original = serve.HOST['join']
        serve.HOST.update(client=None, secret=None, page=None, lease=None, join=None, seen=0)
        status, response = self.request('/link/host', self.host, lease=False, invitation=False)
        self.assertEqual(status, 200)
        self.assertIn(original, response['join'])

    def test_generated_qr_loads_and_both_phones_join_without_host_credentials(self):
        self.state()
        # The QR generator is optional locally, installed by the Render build.
        import importlib.util
        if importlib.util.find_spec('segno'):
            status, image = self.request('/qr.svg', lease=False)
            self.assertEqual(status, 200)
            self.assertIn(b'<svg', image)
        self.assertEqual(self.request('/qr.svg', lease=False, invitation=False)[0], 403)
        for role in ('p1', 'p2'):
            status, response = self.request('/link/claim', {'role': role, 'client': role + '-phone'}, lease=False)
            self.assertEqual(status, 200)
            self.assertTrue(response['ticket'])
        self.assertTrue(serve.seat_taken('p1') and serve.seat_taken('p2'))

    def test_two_phones_claim_distinct_roles(self):
        self.state()
        self.assertEqual(self.claim("p1", "alice")[0], 200)
        self.assertEqual(self.claim("p2", "bob")[0], 200)
        seats = self.request("/link/status")[1]["seats"]
        self.assertTrue(seats["p1"]["taken"] and seats["p2"]["taken"])
        self.assertEqual(self.claim("p1", "third")[0], 409)
        self.assertEqual(self.claim("p2", "alice")[0], 409)

    def test_claim_is_atomic_when_two_phones_pick_same_role(self):
        from concurrent.futures import ThreadPoolExecutor
        self.state()
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda client: self.request("/link/claim", {"role": "p1", "client": client})[0], ["alice", "bob"]))
        self.assertEqual(sorted(results), [200, 409])

    def test_phone_refresh_keeps_its_role_and_ticket(self):
        self.state()
        ticket = self.claim()[1]["ticket"]
        self.assertEqual(self.claim()[1]["ticket"], ticket)

    def test_p2_can_pull_levers_but_cannot_move_or_ready_p1(self):
        self.state()
        self.assertEqual(self.tap(role="p2", call="pullLever")[0], 200)
        self.assertEqual(self.tap("phone:2", role="p2", call="act")[0], 403)
        self.tap("phone:3", role="p2", call="ready")
        self.assertEqual(serve.INTENTS[-1]["args"], ["p2"])
        self.assertEqual(serve.INTENTS[-1]["role"], "p2")

    def test_expired_role_can_be_claimed_by_another_phone(self):
        self.state()
        old_ticket = self.claim()[1]["ticket"]
        serve.SEATS["p1"]["seen"] -= 31
        self.assertEqual(self.claim("p1", "replacement")[0], 200)
        query = urlencode({"role": "p1", "client": "phone", "ticket": old_ticket})
        self.assertTrue(self.request("/link/state?" + query)[1]["seatLost"])

    def test_reclaim_releases_only_selected_role_and_invalidates_old_phone(self):
        self.state()
        self.claim("p1", "alice")
        self.claim("p2", "bob")
        self.tap(role="p1", client="alice")
        self.request("/link/release", {"role": "p1"})
        self.assertFalse(serve.seat_taken("p1"))
        self.assertTrue(serve.seat_taken("p2"))
        self.assertEqual(serve.INTENTS, [])
        self.assertEqual(self.tap("alice:2", role="p1", client="alice")[0], 410)

    def test_second_host_cannot_overwrite_ack_read_or_release(self):
        self.state()
        self.tap()
        other = dict(self.host, client='different-presenter', secret='different-secret-123')
        self.assertEqual(self.request('/link/host', other, lease=False)[0], 409)
        for path, body in [('/link/state', {'host': other['client'], 'session': 'bad', 'seq': 99, 'S': {}}),
                           ('/link/ack', {'session': 'run-a', 'ids': ['phone:1']}),
                           ('/link/release', {'role': 'p1'}), ('/link/intent', None), ('/link/diagnostics', None)]:
            self.assertEqual(self.request(path, body, lease=False)[0], 403, path)
        self.assertEqual(serve.STATE['payload']['session'], 'run-a')
        self.assertEqual(len(serve.INTENTS), 1)
        self.assertTrue(serve.seat_taken('p1'))

    def test_refresh_rotates_host_lease_but_keeps_state_inputs_and_phones(self):
        self.state(8)
        self.tap()
        old_lease = self.lease
        refreshed = dict(self.host, page='refreshed-page-123456')
        self.assertEqual(self.request('/link/host', refreshed)[0], 409)
        serve.HOST['seen'] -= 5
        self.lease = self.request('/link/host', refreshed)[1]['lease']
        self.assertNotEqual(self.lease, old_lease)
        self.assertEqual(serve.STATE['payload']['S']['turn'], 8)
        self.assertTrue(serve.seat_taken('p1'))
        self.assertEqual(len(serve.INTENTS), 1)
        self.assertEqual(self.request('/link/ack', {'ids': ['phone:1'], 'session': 'run-a'}, lease=old_lease)[0], 403)
        self.assertEqual(self.state(9)[0], 200)

    def test_new_host_after_grace_invalidates_previous_game_and_leases(self):
        self.state()
        self.tap()
        serve.HOST['seen'] -= 31
        other = dict(self.host, client='different-presenter', secret='different-secret-123')
        self.assertEqual(self.request('/link/host', other, lease=False)[0], 200)
        self.assertIsNone(serve.STATE['payload'])
        self.assertFalse(serve.seat_taken('p1'))
        self.assertEqual(serve.INTENTS, [])
        self.assertEqual(self.state(99)[0], 403)

    def test_refresh_handoff_is_immediate_single_use_and_keeps_game(self):
        self.state(8)
        self.tap()
        old_lease = self.lease
        proof = {'page': self.host['page'], 'lease': old_lease}
        refreshed = dict(self.host, page='refreshed-page-123456', resume=proof)
        for invalid in [None, {}, dict(proof, lease='wrong'), dict(proof, page='wrong')]:
            self.assertEqual(self.request('/link/host', dict(refreshed, resume=invalid))[0], 409)
        self.assertEqual(self.request('/link/host', dict(refreshed, secret='wrong-secret-123456'))[0], 409)
        status, claim = self.request('/link/host', refreshed)
        self.assertEqual(status, 200)
        self.lease = claim['lease']
        self.assertNotEqual(self.lease, old_lease)
        self.assertEqual(serve.STATE['payload']['S']['turn'], 8)
        self.assertTrue(serve.seat_taken('p1'))
        self.assertEqual(len(serve.INTENTS), 1)
        self.assertEqual(self.request('/link/host', dict(refreshed, page='third-page-123456789'))[0], 409)
        self.assertEqual(self.request('/link/state', {'host': self.host['client'], 'seq': 99,
                                                    'session': 'run-a', 'S': {}}, lease=old_lease)[0], 403)

    def test_hosted_assets_revalidate_but_game_and_local_files_are_not_cached(self):
        def fetch(path, headers=None):
            conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=2)
            try:
                conn.request('GET', path, headers=headers or {})
                response = conn.getresponse()
                return response.status, dict(response.getheaders()), response.read()
            finally:
                conn.close()
        with patch.object(serve, 'HOSTED', True):
            status, headers, body = fetch('/js/link.js')
            self.assertEqual(status, 200)
            self.assertTrue(body)
            self.assertEqual(headers['Cache-Control'], 'public, max-age=0, must-revalidate')
            status, _, body = fetch('/js/link.js', {'If-Modified-Since': headers['Last-Modified']})
            self.assertEqual((status, body), (304, b''))
            for path in ['/', '/link/status', '/qr.svg']:
                self.assertIn('no-store', fetch(path)[1]['Cache-Control'])
        with patch.object(serve, 'HOSTED', False):
            self.assertIn('no-store', fetch('/js/link.js')[1]['Cache-Control'])

    def test_phone_can_release_only_its_own_role(self):
        self.state()
        self.claim('p1', 'alice')
        self.claim('p2', 'bob')
        body = {'role': 'p2', 'client': 'alice', 'ticket': self.tickets[('p1', 'alice')]}
        self.assertEqual(self.request('/link/release', body, lease=False)[0], 403)
        body['role'] = 'p1'
        self.assertEqual(self.request('/link/release', body, lease=False)[0], 200)
        self.assertTrue(serve.seat_taken('p2'))

    def test_diagnostics_are_bounded_and_exclude_credentials_and_game(self):
        self.state()
        self.claim()
        for _ in range(110):
            serve.record_event('test')
        status, report = self.request('/link/diagnostics')
        self.assertEqual(status, 200)
        self.assertEqual(len(report['events']), 100)
        self.assertIn('/link/host', report['requests'])
        raw = json.dumps(report)
        for secret in [self.host['secret'], self.lease, serve.HOST['join'], self.tickets[('p1', 'phone')], 'run-a']:
            self.assertNotIn(secret, raw)



if __name__ == "__main__":
    unittest.main()
