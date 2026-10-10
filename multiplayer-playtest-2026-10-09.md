# Huss Balley multiplayer playtest — 9 October 2026

Recommendation: private beta; hold a full public launch.

## Test setup
One real Studio local server with two separately launched clients (Player1 and Player2).
Production round code and timers ran normally. No forced round outcomes, fake Players, or server teleport harnesses were used for these matches.
Movement used Studio navigation at 1x speed and keyboard input. Controlled throw/catch checks sent the game's normal client remotes. This validates gameplay logic but does not fully validate mouse aiming ergonomics.
A temporary runtime observer recorded round state transitions. No production scripts were edited during this review.

## Three completed matches
1. Dodgers won by surviving the timer. A controlled incoming throw was caught. Catch count increased, win/coins/XP and achievement progress were awarded, results appeared, then both clients returned to the lobby.
2. Player1 was the chaser. A controlled throw hit Player2, converted them from Runner to Thrower, and ended the match with a chaser victory. Tag and XP rewards updated. The next intermission and match began.
3. The displayed round counter reached 02. A keyboard run transitioned to Run at speed 25 and a slide executed. Player1 subsequently received a ball tag (Player2's tag count increased), became a chaser, and the match ended. Round 03 then started. No anti-cheat reason was recorded for either player.

All three server/client consoles were empty when checked after the matches.
No evidence of the previously reported runaway ball physics occurred in the controlled throws.
The round counter reset to 01 after the dodger win, then advanced to 02 and 03 after chaser wins, as requested.

## Issues / release gaps
- Hero/Chicken choice is absent from the current RoundManager.
- Only one crossing is required (MAX_CROSSINGS = 1); the repeated crossing sequence from the reference is absent.
- A runner can win by surviving the timer without crossing. Verified in match 1. This can undermine the intended crossing pressure.
- The Servers button is visible again, contrary to the earlier removal request.
- Studio dummy accounts (-1/-2) and their result portraits appeared black. Those are synthetic users; this does not establish a real-account avatar bug.
- Progress and currency rewards updated, but no rejoin/persistence test was performed.
- The second map, mobile controls, real network latency, purchases and the ten-minute reward were not tested in this session.
- A successful finish-line crossing was not verified in these three matches.

## Feel assessment
The catches, quick slides, role conversion and visible progression provide promising feedback.
The waiting-based victory and incomplete crossing structure weaken sustained tension and replay variety.
This is an engineering and presentation assessment, not a measurement of player enjoyment or dopamine.
A small group of human players should test whether they voluntarily replay, understand losses/catches, and feel in control.

## Evidence
See multiplayer-playtest-2026-10-09.json for observed transitions and final player counters.
