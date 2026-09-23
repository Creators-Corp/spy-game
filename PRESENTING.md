# Deux Complices — running the demo

## One main screen and two phones

1. Open the game on the laptop or TV browser. Keep that tab open and active.
2. Press **CONNECT PHONES**.
3. Scan the **same QR code on both phones**, or use **COPY LINK** and open that
   address on each phone.
4. One phone chooses **PLAYER 1 · ASSANE**. The other chooses **PLAYER 2 · BENJAMIN**.
   A role that is already taken is disabled.
5. Benjamin chooses the contract. Both players press **READY** on their phones.
6. Close the connection panel on the main screen and play.

Assane moves and interacts with puzzles. Benjamin has the map, dossier and support
controls. They need to describe what they see and talk each other through the job.

The connection button shows how many phones have joined. Open it at any time to
check both players or disconnect one. Disconnecting one phone does not remove the
other. **CHANGE PLAYER** on a phone releases its role and returns to role choice.

## Connecting in the room

With `python serve.py`, put both phones on the same network as the laptop and
use the QR code. Do not type `localhost` or `127.0.0.1` into the phones: those
addresses refer to the phone itself. Some venue Wi-Fi blocks devices from reaching
each other; use the hosted Render address or a hotspot in that case.

With the Render address, each phone only needs an internet connection.
Each new host tab or browser starts its own game room. Scan that host's QR on
both phones; another group's phones and progress stay separate.

## If something goes wrong

| What you see | What to do |
|---|---|
| A role says **Already connected** | Choose the other role. To replace a phone, disconnect its role on the main screen first. |
| **RECONNECTING…** | Keep the phone page open. It retries automatically; returning to the browser triggers a retry. |
| **WAITING FOR THE MAIN SCREEN…** | Keep the main game tab open and active, and check its internet connection. |
| The phone was deliberately disconnected | Choose a free role again. It will not take its old role back automatically. |
| No **CONNECT PHONES** button | This copy has no relay. Use the Render version or run `python serve.py`. |
| The main screen asks for a hosting token | This is an older build. Deploy the updated client and server together, then reload all devices. The current version shows its QR automatically. |
| **Another tab is hosting this room** | Use the original tab to continue that game, or choose **START SEPARATE GAME** to play independently. A normal refresh reconnects automatically. |
| **Continue your heist?** | Choose **RESUME GAME** to keep progress and the connected phones, or **START NEW GAME** for a fresh run. |

A phone keeps its role when refreshed. Short interruptions preserve the seat for
30 seconds, with the idle-pressure clock paused while the connection is stalled.
After a deployment, reload the main screen and both phones before starting a demo.
Refreshing the main screen offers to resume the saved game in that same tab.
Keep the tab open: this is refresh recovery, not a saved game shared across devices.

If a connection problem happens, open **CONNECTION REPORT** on the affected phone
and in the main screen's connection panel. Use **SAVE REPORT**, or select and copy
the report text if the browser cannot download it. Keep both reports to help
diagnose the problem. Reports include timings and errors, without join tokens or
game contents.

## One screen, or one phone

The prototype also works with all three panes on one screen. Both players press
READY there. Or connect just one phone and play the other role on the main screen.

Guards move when Assane moves; lingering can still raise suspicion. Getting caught
starts La Tchatche: Assane describes the guard, Benjamin finds the matching face
and information, and they talk their way out together.
