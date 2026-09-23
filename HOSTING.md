# Publishing the playable prototype

The published site opens directly. There is no password screen, encryption,
or browser decryption step. Anyone who can reach the site can load the game
and its assets.

## Build and verify

```sh
python tools/pack.py
python tools/verify.py
```

The build uses only Python's standard library. It replaces `dist/` with
`index.html`, `js/`, `styles/`, `art/`, and `.nojekyll`. Development tools,
documentation, and local handouts are excluded. Verification checks that every
published file matches the source and that no stale files remain, including
files from the old encrypted build.

## GitHub Pages

1. Set **Settings → Pages → Source: GitHub Actions**.
2. Push to `main`, or run the publishing workflow manually.
3. Share the site address. No passphrase is needed.

The workflow builds, verifies, and publishes `dist/`. The former
`PROTOTYPE_PASSWORD` secret is no longer used and can be removed.
GitHub Pages runs the three panes on one screen; it has no phone relay.

## Hosting with two phones

`render.yaml` configures the Python service:

- Build: `pip install --disable-pip-version-check segno && python tools/pack.py && python tools/verify.py`
- Start: `python serve.py`
- Phone invitations are generated automatically for the active host. No hosting
  token needs to be entered. Legacy `SEAT_TOKEN` environment settings are ignored
  and can be removed from existing services.
- On hosts other than Render, set `PUBLIC_URL` to the site's public address.
  `PORT` defaults to 8080.

Hosted mode serves `dist/` and refuses to start if it has not been built.
Keep one service instance because the relay holds its state in memory.
Existing deployments can remove the unused `PROTOTYPE_PASSWORD` environment
variable when adopting the new build command.

## Working locally

```sh
python serve.py
```

Open http://127.0.0.1:8080/index.html. Local mode serves the working tree with
no-cache headers and supports the optional phone connections. The page can also be
opened directly from disk for a single-screen demo.

## Mobile connection recovery

The relay keeps each player’s seat for 30 seconds after that phone’s last request. After five
seconds without a fresh connection, the presenter pauses the idle-pressure clock
while the seat is held. The presenter can disconnect either role independently in the
CONNECT PHONES panel. Each phone can also use CHANGE PLAYER to release its role. A phone shows reconnecting or waiting for the presenter and
blocks new input until it has fresh state.

Each polling loop allows one in-flight request, with an eight-second deadline
and retry delays that grow to about five seconds. Returning to the browser or
coming online triggers a retry. Taps are retried with stable IDs, retained by the
relay until acknowledged, and applied once by the presenter. Unsent taps older
than eight seconds and queued relay taps older than ten seconds are discarded
instead of moving the player unexpectedly after a long outage.

A restarted relay identifies its new version history, and the presenter sends
state at least once a second while connected, even when the game is unchanged.
This recovers the current game while the presenter tab remains open. Refresh
recovery also uses a versioned checkpoint in that tab's session storage (see below).

For Render, check the actual service settings (the repository cannot verify the
live dashboard):

- Use **one instance**, with autoscaling disabled. It supports multiple rooms
  in memory; separate service instances do not share those rooms.
- Check the service's **compute plan**, separately from the Pro workspace plan.
  Paid workspace membership alone does not change a Free service's limitations.
- Keep the presenter tab open and active. Browsers can suspend background pages.
- Deploy the client and server together, then reload both devices before a demo:
  the role-claim and acknowledgement protocol requires the updated client and relay.

References: [Render compute vs. workspace plans](https://render.com/docs/free),
[Render scaling](https://render.com/docs/scaling).

Regression checks (Python and Node, no extra packages):

```sh
python -m unittest discover -s tools -p test_relay.py
node tools/test_link.cjs
```

## Joining both roles

Open CONNECT PHONES on the main screen. Both phones scan the same QR code and
choose different roles. The join address uses `?join=1`; the QR includes the
automatically generated invitation, so nobody needs to enter a password. Legacy `?role=p1` and
`?role=p2` links can request a role directly, but cannot take an occupied role.

Role claims are atomic and held by a per-phone ticket. Each state request renews
that role’s lease. The server rejects inputs for the wrong role, forces READY to
refer to the claimed player, and invalidates the ticket on a manual disconnect.
P2 may choose a contract before readying and operate the support levers. Both
phones may request a restart from the result screen. Local dossier browsing
stays on P2’s phone.

Connected phones fill the browser viewport; device frames remain on the host.
Door/exit-keypad digits, CLR, and safe glyphs/undo preview immediately on the phone. Snapshots
include recently applied input IDs, so a delayed snapshot cannot overwrite newer
entry edits or replay edits already confirmed by the host. Puzzle results still
come from the host. Pending previews expire on interruption and reset on a new run
or puzzle exit. CLR travels through the same ordered, deduplicated input queue.
Active state/input polls run every 100 ms after completion. State publication
renews the host lease directly, avoiding an extra ownership request per update.
All queued phone actions show SENDING until the host confirms them. Only entry
text is predicted; movement, lever effects and puzzle outcomes remain authoritative.

Deploy protocol version 7 to client and server together and reload all devices.

## Main-screen ownership and refresh recovery

The relay grants one main screen per room an opaque host lease. Publishing state, reading
or acknowledging inputs, disconnecting other players, and reading server
diagnostics require that lease. Phone tickets can release only their own role.
Host credentials stay in the main tab's session storage, outside phone snapshots,
QR codes and diagnostics. A separate invitation derived from the host secret is
embedded in the phone QR; it grants no host privileges and remains stable when
the same host reconnects after a relay restart. Each fresh browser tab gets its
own room automatically; the room ID travels in every relay request and phone QR.
State, phone seats, inputs, acknowledgements, leases and diagnostics are isolated
by room. Opening another browser does not block or replace an existing game.
A duplicated tab may inherit the original tab's identity; START SEPARATE GAME
creates a fresh identity and checkpoint without affecting the original room.

Rooms are removed after 30 minutes without requests. The registry is capped at
100 rooms; this is a memory bound, not a guaranteed concurrent-player capacity.
An expired or restarted relay can be recreated by its original host with the same
QR invitation, a new epoch, and the saved checkpoint. Phones wait and rejoin when
that host returns. A room ID alone never authorizes joining or hosting.

A normal refresh passes a one-use handoff through the tab's session storage and
receives a new lease immediately, invalidating the old page's requests. If the
page crashes before saving that handoff, the four-second heartbeat window applies;
retry backoff can make that fallback wait a few seconds longer. An unrelated main screen may
start a fresh game after the previous host has been absent for 30 seconds;
that clears the old game and phone claims. Keep the presenting tab active.
Ownership is in memory and is reset by a server restart; first claim wins again.

Hosted artwork, fonts, styles and scripts may be cached, but must be revalidated
on each use; unchanged files return 304 without downloading their contents again.
The entry page, QR and relay responses remain uncached. Local development keeps
no-cache headers for all files.

Checkpoints save the contract, full state, named pending puzzle transitions,
run ID, sequence and applied input IDs together. They are saved on render/ready,
every second, before acknowledgment, and when leaving the page. After refresh,
RESUME GAME restores the checkpoint without charging idle time while away;
START NEW GAME creates a new run. Phone assignments stay on the relay.
Pending puzzle animations resume their remaining delay. Reset cancels old timers.

This is recovery in the same browser tab, not a cloud save or transfer to another
device. Closing the tab, clearing storage, or blocking session storage can remove
recovery. Abrupt browser/process termination may lose the most recent unsaved
second. Increment the checkpoint schema in recovery.js when game-state or content
changes make existing saves incompatible.

## Connection diagnostics

CONNECTION REPORT is available in the main screen's phone panel, on the phone
role picker and footer, and on the host-waiting screen. It shows a selectable
report and a SAVE REPORT link. Ask for reports from both the affected phone and
the main screen after a problem.

Each browser records request/failure/timeout totals, latest and maximum request
latency, offline/online and background/foreground events, and recovery durations
per endpoint. The last 100 events are retained in that tab's session storage.
The host report also includes server response/error counts, queue length, seat
ages, and the last 100 ownership/seat events. Server diagnostics reset on restart.
Reports exclude URL queries, tokens, tickets, host secrets, input arguments and
game snapshots. No third-party telemetry service is used. Server access errors
log HTTP status only, so join credentials do not enter application access logs.
