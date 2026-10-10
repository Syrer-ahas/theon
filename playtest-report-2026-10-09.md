# Huss Balley playtest — 9 October 2026

The crossing loop is improved and passed controlled local multiplayer tests. I do not recommend a large advertised launch yet: the main economy resets between sessions, paid products are unconfigured, and live-server/network/mobile performance is unverified.

## Three completed matches after the crossing and AFK fixes

Three real Studio clients shared one local server. Movement used normal Humanoid controls; choices and throws used the gameplay remotes. Outcomes were produced by the game, without setting winners or teleporting players across the arena.

| Match | Scenario | Result |
|---|---|---|
| 1 (session 2) | Hero crossed solo; teammate stayed locked until release. Both crossed to line 2 and back to line 1. Crossing 3 was deliberately missed. | Chasers won on the crossing deadline. |
| 2 (session 3) | Chicken released both dodgers. Both deliberately waited at the starting line. | Chasers won after 30 seconds; waiting did not win. |
| 3 (session 4) | Desert Canyon was chosen by voting. Hero missed the 20-second solo deadline and became a chaser. Last dodger crossed normally. | Dodgers won; win counter recorded four matches and reset the next round to 01. |

No console errors appeared on the server or any of the three clients in these tests. This is local functional evidence, not proof of behavior under internet latency or a crowded production server.

## Changes installed in Studio

- First chaser selects a match participant; selected dodger chooses Hero or Chicken.
- Hero crosses alone first; Chicken starts a group crossing.
- Group crossings alternate between both safe lines only after every surviving dodger arrives.
- Each group crossing has a fresh 30-second deadline; solo Hero has 20 seconds.
- Last surviving dodger wins by reaching the target line.
- Crossing credit requires the player's root inside the target zone, preventing an early hand/foot touch from awarding the crossing.
- Match participants return to the lobby even when everyone switches to AFK.
- Watch appears only for lobby players during an active match.
- Final small refinements preserve the position of players already exploring the lobby and correct their spectator headline. These refinements were syntax checked and received a startup check; the three-match sequence preceded these two refinements.

## Additional checks

- Manual player dropdown and Hero button reached the real Solo phase.
- Spectating worked; exiting restored Custom camera and the local Humanoid as CameraSubject.
- A normal ball hit converted a dodger to a chaser and ended the match. Catching passed the earlier two-client test, but this session's timed catch attempt missed; catching responsiveness under latency still needs human testing.
- Free spin awarded 500 coins and restarted the cooldown.
- Welcome reward became claimable after ten real minutes: first claim added 200 coins; repeated claim added nothing.
- Shop, 3D ball previews, earned-title requirements, abilities inventory, emote Coming Soon wheel, map voting, results, update log, quests, settings, journey, spin, gamepass preview and spectator UI were visually inspected.
- Studio's negative-user-ID test avatars render black. Real-account avatar appearance needs a live/private-server check.
- Test-only observers and input drivers existed only in the discarded play session.

## Release blockers

1. Coins and gems are session-only in HudGameFeatures. Coin-bought balls and the equipped ball are also not persisted there. Players should not lose purchases or earned currency when rejoining.
2. Four ball gamepasses and paid spin products are not configured; their UI correctly says Coming Soon. No purchase/grant transaction was tested.
3. Verify saved progress and owned purchases by leaving/rejoining a private live server using real accounts.
4. Test with human players on mobile and ordinary internet connections, including catches, slides, disconnects and a fuller server.

## Feel and pacing

The clear solo opening, turnaround prompts, deadlines and last-dodger finish give the game a stronger tension/reward loop. That is a design assessment: controlled clients cannot establish whether real players find it satisfying or want another match. A short private session with real players should precede paid advertising.

[Open the UI gallery](playtest-ui-gallery.html)

Raw evidence: playtest-flow-patched-2026-10-09.json. Sources exported to exports/HussHUD.
