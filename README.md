# Crease — Live multiplayer arcade cricket

A standalone browser game for **two active players**, with up to eight spectators, private room codes, room chat, avatars, timed batting, player-controlled bowling, and a practice opponent. Upload this project to GitHub and deploy it as a Render **Web Service**.

This is a 2D arcade game, not an eleven-player cricket simulator. Each player controls one entire innings. Fielding is automatic; there are no extras, LBW, run-outs, manual running, or individual batsman rotation.

## Deploy on Render

1. Extract `Cricket-Game-Render.zip`.
2. Create a GitHub repository, such as `Cricket-Game`.
3. Upload **the contents inside `Cricket-Game`**, not the ZIP. `package.json`, `package-lock.json`, `server.js`, `game.js`, `scripts-build.js`, and `render.yaml` must be at the repository root. Include the `public` and `test` folders.
4. On Render, create a **Web Service**, connect the repository, and set:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Branch | Your uploaded branch, usually `main` |
| Root directory | Leave blank |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check | `/healthz` |
| Environment variable | `NODE_VERSION=22` |
| Environment variable | `NODE_ENV=production` |

`render.yaml` also supports creating a Blueprint. Use one service instance. This is **not a Static Site**: the Node server runs matches, chat, and live event streams. No database, API key, or paid AI service is required. There are no third-party runtime dependencies. The build command checks the static client files; no bundler is needed.

Open the Render URL after deployment. Create a room, copy the invite link, and have your opponent enter a name and join. Use different devices, browser profiles, or one regular and one private browser window for separate players. Tabs in the same browser profile share the same player identity.

## Play

### Set up a match

Match settings appear **above the pitch in the lobby**. The host chooses **Overs per innings: 1, 2, or 5** before starting the toss. Other players see the selection but cannot change it. To change overs after a match, select **Set up a rematch**.

- Choose **1, 2, or 5 overs** per innings and **1, 3, or 5 wickets**. Defaults: two overs, three wickets.
- The host can add/remove a practice bot while in the lobby.
- Start the match with the toss. Its winner gets 15 seconds to choose batting or bowling. If they do not choose, they bat first.
- Additional arrivals watch as spectators. Spectators can use chat but cannot control play.

### Easy controls — the new default (v1.4)

You only need **one button while batting**: tap the large **HIT** button on the pitch or press **Space**. Wait for the indicator to enter the green zone and the **HIT NOW** cue to appear. The center gives the best score, but the full green zone makes contact. Aiming and shot selection are automatic. The normal contact window spans **300 ms before to 300 ms after contact**, so you have 0.6 seconds to connect.

| Timing error in either direction | Runs |
| --- | --- |
| Up to 90 ms | 6 |
| Up to 150 ms | 4 |
| Up to 225 ms | 2 |
| Up to 300 ms | 1 |
| Beyond 300 ms | Miss (unless a power rescues it) |

Base flights last 2.2 seconds for pace, 2.5 seconds for spin and 2.8 seconds for slower balls. A 1.1-second run-up gives warning. Missing a central ball can still bowl you; badly timed off/leg shots can be caught. One hit per ball still applies. Feedback tells you whether to hit earlier or later. The practice bot has imperfect timing too.

**Bowling:** press **Bowl delivery**. The client picks a line and delivery for you. No line or type selection is needed.

**Superpowers:** your avatar stays distinctive without another button. Bowling power activates on the first delivery of each over. Batting power is used automatically only when it improves the result, at most once per over:

- Focus widens timing windows by 25%.
- Shield converts a catch into a dot, never saving a bowled dismissal.
- Sidestep rescues a near miss between 300 and 450 ms off contact for one run.
- Rally converts a single into two runs.

Because aiming is automatic, Sidestep uses a timing rescue instead of lane correction in Easy controls. Bowling bends stay visible and have the same landing lane; speed powers still vary the flight time. Equal resource limits apply, but human balance still needs playtesting.

**Classic and Superpowers both support Easy controls.** Only the host can change the match-wide Controls setting, before the toss. Choose **Advanced · manual controls** to use the previous lane, shot and manual power controls described below. This choice applies to both players.

### Avatar powers in Advanced controls

Choose **Superpowers** in the lobby before the toss. Each avatar now has its **own fixed combination** of one batting and one bowling power. Select an avatar before joining, or open **Choose your avatar** in the lobby to change it. Picks lock at the toss; duplicate picks are allowed. Classic remains the default and disables all powers, with identical base stats for every avatar.

| Avatar | Personality | Batting power | Bowling power |
| --- | --- | --- | --- |
| Fox | Crafty improviser | Sidestep | Curve |
| Tiger | Aggressive striker | Focus | Blaze |
| Panda | Patient defender | Shield | Float |
| Lion | Composed captain | Rally | Late Break |
| Penguin | Nimble accumulator | Rally | Curve |
| Owl | Calculating tactician | Focus | Float |
| Dragon | Fearless attacker | Shield | Blaze |
| Robot | Adaptive technician | Sidestep | Late Break |

Every combination is different. Individual powers are shared across two avatars, so identities come from the combination and how you use it. There are no hidden stats, rarities, upgrades, or passive bonuses.

| Power | Strength | Limit / counterplay |
| --- | --- | --- |
| Focus | 25% wider timing windows | Still needs correct lane; cannot prevent every catch or miss. |
| Shield | Saves one caught dismissal | Saves it as a dot ball; never protects the stumps. |
| Sidestep | Corrects aim one lane away | Caps even perfectly aligned shots at two runs; cannot cross two lanes or fix bad timing. |
| Rally | Well-timed defence scores two | Requires the correct lane within 180 ms of contact; no benefit to drives or lofts. |
| Blaze | 15% shorter flight | Minimum 1.2 seconds; visible warning, normal 1.1-second run-up, no extra wicket chance. |
| Curve | Smooth sideways bend | Fully visible; normal speed, scoring, and landing lane. |
| Float | 15% longer flight to bait an early swing | A patient batter gets extra time to react. |
| Late Break | Visible bend in the second half of flight | Announced when bowled, smaller bend than Curve; normal speed and landing lane. |

Each player gets **one batting charge per over when batting, and one bowling charge per over when bowling**. Select your power before pressing Swing or Bowl, or leave **Save charge** selected. Charges refresh every six balls and at the innings swap; unused charges do not accumulate. Each activation lasts one ball. No stacking within a role, automatic runs, automatic wickets, or scores above six. The server rejects other avatars' abilities, duplicate activations, and mid-match avatar changes. Bots pick an avatar and follow its kit and the same charge limits.

Balance is based on equal charge budgets, unchanged base stats, bounded effects, and situational trade-offs. Tests verify these rules, but do not prove equal human win rates. Live head-to-head playtesting is needed to tune power strength across skill levels and connection speeds. In particular, timing powers and lane powers help different kinds of batting errors.

The interface shows each avatar's personality, powers and limitations in the picker and lobby. The pavilion lists everyone's kit, and the live controls expose only your own power. Colored uniforms, avatar icons, ball colors and batting auras distinguish characters and activations.

### Bowl (Advanced controls)

Pick a line: **Off**, **Stumps**, or **Leg**. Then choose **Pace**, **Slower**, or **Spin**, and press **Bowl delivery**.

The 1.1-second run-up lets both clients prepare. Pace travels faster, slower balls take longer, and spin bends later toward its selected lane. The opponent cannot see your chosen controls before you bowl. The ball trajectory becomes visible once the delivery begins.

You have 20 seconds to bowl. If the deadline passes, the server bowls a random delivery so the match does not stall.

### Bat (Advanced controls)

Match your batting lane to the ball and swing when it reaches the glowing contact crease. The timing bar reaches its marked contact zone at the same moment.

| Control | Action |
| --- | --- |
| A / left arrow | Move one lane towards Off |
| D / right arrow | Move one lane towards Leg |
| 1 | Defend |
| 2 | Drive |
| 3 | Loft |
| Space / Swing button | Play one shot |

Touch players can use the lane, shot, and Swing buttons. Typing in chat does not trigger batting controls.

- **Defend:** a well-timed, correctly aligned shot scores one; slightly mistimed defence is a dot.
- **Drive:** excellent timing scores four, reasonable timing two, weaker contact one.
- **Loft:** excellent timing scores six, good timing four; poor timing risks a catch.
- A complete miss or wrong lane on a ball at the stumps is bowled. An off/leg ball left alone is a dot. A badly judged loft can be caught.
- You get one swing per delivery. A shot does not guarantee runs.

These are deliberately simplified arcade outcomes. The timing thresholds and risk rules are in `shotResult()` in `game.js`.

### Chase and result

Six deliveries make one over. An innings ends at the overs or wickets limit. There is an eight-second innings break, then the players swap roles. The second player needs the first score plus one to win; reaching that target ends the chase. Equal completed scores are a tie. Session win counts appear beside player names; the host can set up a rematch after the result.

### Practice opponent

The bot varies delivery type and line, aims mostly at the right batting lane, and uses imperfect timing. It is a scripted practice opponent, not an AI language model. Bot games can complete without the human interacting, because bowling and batting deadlines continue.

### Room chat and spectators

All people in a room can read and send chat. Messages have a 250-character limit, 20-message-per-minute limit per player, and a 70-message room history. Text is rendered as text, never as HTML. Anyone with the room code can try to join; there are no accounts or passwords.

## Live timing, reconnects, and hosting limits

The server controls the match clock, deliveries, scoring, and game phases. Clients animate at their own display frame rate from server delivery timestamps. Updates arrive over Server-Sent Events; inputs are sent over HTTP. The client periodically measures round-trip time and estimates server time.

Swing timestamps are accepted only within a bounded window (up to 220 ms behind receipt, at most 80 ms ahead), with one swing per delivery. The server clamps future timestamps and rejects stale balls or wrong-player actions. These checks support casual play, not tournament-grade anti-cheat protection. Very high or unstable latency can cause a shot to be rejected. Stay on the game tab while batting so browser throttling does not hide the delivery.

A brief connection loss triggers automatic stream reconnection. Refreshing and joining the same room from the same browser restores the player's seat. Games do not pause for disconnects: automatic bowling and missed shots still apply. Starting another room creates a separate match.

Matches, chat, session wins, and rooms live in memory. They disappear if the service restarts or redeploys. Empty rooms expire after six hours. There is no permanent leaderboard, saved match history, or cross-device account recovery. Use only one server instance; scaling without shared storage would split rooms. A sleeping free service can take time to wake up, so open the app before inviting friends.

## Run locally

Install Node.js 22 or newer, then open a terminal inside the extracted folder:

```sh
npm ci
npm run build
npm start
```

Visit `http://localhost:3000`. The `PORT` environment variable can change the listening port. The server binds to all interfaces, so other devices on your network can use your computer's address if permitted by your firewall. Hosted HTTPS is the intended deployment environment.

## Validation

```sh
npm test
```

The 39 automated tests cover host permissions, spectators, toss choices and timeout, automatic bowling, six-ball overs, scoring by shot type, timing rejection, wickets, successful chases, defended targets, ties, rematches, complete bot matches, HTTP routes, room-isolated chat, event-stream reconnects, and hiding the server's catch randomization.

Power tests additionally cover Classic isolation, Focus thresholds, Shield exceptions, delivery speeds, shared charges, over/innings recharge, invalid requests, distinct kits, avatar ownership and selection locks, all eight avatars completing matches, each new power’s limits, public power metadata, and complete Superpowers bot matches.

Easy-control tests cover default settings, automatic aim, timing bands across every lane, mistakes and missed shots, input validation, automatic power benefits and charge limits.

Client JavaScript was syntax-checked and server/API tests passed. A visual browser/device playtest was not available in the build environment. Before a group match, try a one-over match on two devices to check display size and connection timing.

## Files

- `game.js` — match state, input rules, timing, scoring, bot scheduling
- `server.js` — HTTP API, live event streams, room chat, clocks, static files
- `public/index.html` — interface
- `public/characters.js` — shared avatar kits, ability descriptions and visible bend paths
- `public/app.js` — controls, clock sync, live connection, Canvas animation
- `public/style.css` — desktop/mobile layout
- `test/` — game and API tests
- `render.yaml` — Render Blueprint configuration

Original code and Canvas graphics. No commercial game's art or question bank is included.
