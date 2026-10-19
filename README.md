Pokémon Showdown
========================================================================

Navigation: [Website][1] | **Server repository** | [Client repository][2] | [Dex repository][3]

  [1]: http://pokemonshowdown.com/
  [2]: https://github.com/smogon/pokemon-showdown-client
  [3]: https://github.com/Zarel/Pokemon-Showdown-Dex

[![Build Status](https://github.com/smogon/pokemon-showdown/workflows/Node.js%20CI/badge.svg)](https://github.com/smogon/pokemon-showdown/actions?query=workflow%3A%22Node.js+CI%22)
[![Dependency Status](https://img.shields.io/librariesio/github/smogon/pokemon-showdown)](https://libraries.io/github/smogon/pokemon-showdown)


Introduction
------------------------------------------------------------------------

Pokémon Showdown is many things:

- A **website** you can use for Pokémon battling

  - http://pokemonshowdown.com/

- A **JavaScript library** for simulating Pokémon battles and getting Pokédex data

  - [sim/README.md](./sim/README.md)

- Some **command-line tools** for simulating Pokémon battles (which can be used in non-JavaScript programs)

  - [COMMANDLINE.md](./COMMANDLINE.md)

- A **web API** for the web site for Pokémon battling

  - [pokemon-showdown-client: WEB-API.md](https://github.com/smogon/pokemon-showdown-client/blob/master/WEB-API.md)

- A **game server** for hosting your own Pokémon Showdown community and game modes

  - [server/README.md](./server/README.md)

Pokémon Showdown simulates singles, doubles and triples battles in all the games out so far (Generations 1 through 9).

Chimera fusion mode
------------------------------------------------------------------------

This fork includes **[Gen 9] Chimera**, a six-fusion draft with CPU and live friend
battles in the standard animated Showdown battle interface. No separate client
checkout is required.

### 1. First-time setup

Install Git and Node.js **22.18+** (24 LTS recommended, including npm). Check
your installation with `git --version`, `node --version`, and `npm --version`.

Clone the fork onto your Desktop:

```sh
cd ~/Desktop
git clone https://github.com/SaiKotha-3972/pokemon-showdown-fusionMode.git
cd pokemon-showdown-fusionMode
```

If the repository is already there, **do not clone it again**; just run
`cd ~/Desktop/pokemon-showdown-fusionMode`.

Install dependencies and build:

```sh
npm ci
npm run build
```

### 2. Start the server

In a terminal, run:

```sh
cd ~/Desktop/pokemon-showdown-fusionMode
node pokemon-showdown start 8127
```

Leave this terminal open. Wait for the message that the server is listening on
port **8127**, then open:

**http://localhost:8127/view-chimera**

The redirect to **https://localhost--8127.psim.us/view-chimera** is normal:
`psim.us` provides the hosted Showdown client, which connects to your local
server. You still need internet access to load that client and its assets.
Choose a username before starting a draft. You can also enter `/chimera` in
Showdown chat to open the lab.

Use port **8127** consistently throughout this guide. The alternative
`npm start` uses the configured port (normally **8000**), so do not run both
commands unless you intentionally want two separate servers.

### 3. Draft a team and play the CPU

1. Click **Start a draft**.
2. In each round, choose two of the three offered parents. You may reroll the
   whole draw, but only twice across the entire draft.
3. Assign exactly three stats to Parent A; the other three come from Parent B.
4. Choose a type from each parent, an ability, a held item, and one to four
   different moves from the available parent moves.
5. Click **Add fusion and draw next round**. Repeat until you have six fusions.
6. Click **Battle the CPU**.
7. In the native battle room, choose your lead/team order when prompted, then
   use the move and switch buttons each turn. Confirm the full team order if
   the client asks for all six positions.

Battles have the same animated battlefield, sprites, team preview, controls,
and log as Random Battle. Moves and switches use the real Showdown simulator,
including abilities, items, status, hazards, accuracy, and PP.

To leave an unfinished battle, enter `/forfeit` in that battle's chat.
Afterward, use **Return to Chimera builder / rematch** in the battle log
(open the **Chat** panel if the log is hidden), or enter `/chimera` in chat.
Use **Rematch with this team** after a CPU battle for another CPU match, or
**New draft (discard current)** for a fresh team. Finish or forfeit your current
battle before starting another.

### Fusion rules

* Six rounds: draw three parents and choose two per fusion; **two whole-draw
  rerolls total**, shared across the draft.
* Twelve distinct parent **forms** per team. Regional/alternate forms count
  separately (Samurott and Samurott-Hisui may both be used). The CPU has its own
  independent parent pool and follows the same team-building rules.
* Fully evolved Gen 9 species with supported Showdown random-battle sets,
  including legendary and Paradox Pokémon. Unavailable species, battle-only
  transformations, and forms requiring specific items or moves are excluded.
* Each of the six stats comes from exactly one parent: three from A, three from
  B. Choose one type from each parent; matching types produce a monotype fusion.
* Choose any normal/hidden ability from either parent, one of the two generated
  parent items, and one to four distinct moves from their generated four-move
  sets. Parent sets are generated without Tera-only roles.
* Level 100, Serious nature, 31 IVs and 85 EVs in every stat. No Terastallization,
  Mega Evolution, Z-Moves or Dynamax. No additional competitive bans.

Fusions use the first parent's standard sprite, not custom fusion artwork.
The CPU uses Showdown's existing random-player AI and answers normal simulator
requests, including forced switches and revival. This is not a competitive
search AI. Use the Chimera lab's battle/challenge controls rather than the
client's regular human challenge/rematch button, which does not run this draft
workflow.

### 4. Play a friend over the internet

Your friend does **not** need to clone the repository, install Node.js, or run
a server. Only the host runs the server and tunnel; both players use a browser.

#### Host: open a temporary public tunnel

Keep the server from step 2 running. On macOS, install `cloudflared` once using
[Homebrew](https://brew.sh/) if it is not already installed:

```sh
brew install cloudflared
```

For other operating systems, follow Cloudflare's
[cloudflared installation guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

Open a **second terminal** and run:

```sh
cloudflared tunnel --url http://127.0.0.1:8127
```

The tunnel prints a temporary `https://....trycloudflare.com` URL. This exposes
the **whole Showdown server publicly**, not just Chimera. Share it only with
people you trust. No router port forwarding, paid hosting, or Cloudflare account
is required for a Quick Tunnel. Quick Tunnels are for temporary testing and
have no uptime guarantee.

Append `/view-chimera` to the URL printed by **your current tunnel**. For
example, if it prints `https://example-name.trycloudflare.com`, share
`https://example-name.trycloudflare.com/view-chimera` (this is a placeholder,
not a working server).

Keep **HTTPS** in the public URL so the hosted client connects securely through
the tunnel on port 443. A redirect to a long `psim.us` address is expected.
Share the public link, **not localhost**: localhost on your friend's device
points to their device, not your Mac.

Leave both terminals running and keep your Mac awake and online. You can
optionally run `caffeinate -i` in a third macOS terminal while playing; stop it
with Ctrl+C afterward. This does not keep the server reachable if the Mac is
shut down, loses internet, or sleeps when its lid is closed.

#### Both players: draft and challenge

1. Open the host's public lab link and choose **different usernames**.
2. Each finish drafting six fusions.
3. In the lab under **Play a friend**, enter the other player's exact username
   and click **Challenge a friend**.
4. The recipient dismisses the notification, opens `/chimera` if necessary,
   and clicks **Accept friend challenge** or **Decline challenge**.
5. Acceptance opens the **same native battle room** for both players, using
   their drafted teams. No team export/import is required.

Both players must be on the **same server**, not the main public Showdown
server or two separate local servers. Both teams are locked while a challenge
is pending. Either player may cancel; challenges expire after five minutes or
when either player disconnects. Wait ten seconds between sending challenges.
The recipient's challenge-blocking settings are respected.

The server validates both teams again on acceptance. Parent uniqueness applies
per team, not across opponents. After the battle, return to the lab and send a
new friend challenge with the same team, or start a fresh draft. There is no
public matchmaking.

### 5. End a session and stop hosting

1. Finish the battle or enter `/forfeit` in its chat. Cancel any pending
   challenge in the lab.
2. In the **tunnel terminal**, press **Ctrl+C**. This removes public access;
   remote players will disconnect.
3. In the **server terminal**, press **Ctrl+C**. This stops the game server,
   including local access and any unfinished battles.
4. If you started `caffeinate -i`, press **Ctrl+C** in that terminal too.

Closing a browser tab does **not** stop the server or tunnel. Stopping only the
tunnel leaves the server available locally. Stopping only the server leaves
the tunnel running, but visitors cannot play.

If the server/tunnel was started in the background by an assistant and there
is no terminal to interrupt, ask the assistant to stop the Chimera server and
tunnel. Alternatively, on macOS, inspect the exact processes:

```sh
ps -ax -o pid,ppid,command | grep '[n]ode pokemon-showdown start 8127'
ps -ax -o pid,ppid,command | grep '[c]loudflared tunnel --url http://127.0.0.1:8127'
```

Confirm the command matches this game's launcher or tunnel, then run
`kill PID` for each matching process, replacing `PID` with its actual numeric
process ID. Do not stop unrelated Node.js servers or tunnels.

### 6. Start again or load code updates

For a normal later session, repeat step 2, then start a new tunnel if playing
remotely. You do not need to clone or reinstall dependencies every time.
The tunnel URL changes when the tunnel restarts: share the new link.

To load updated code, stop the server first, then run:

```sh
cd ~/Desktop/pokemon-showdown-fusionMode
npm run build
node pokemon-showdown start 8127
```

If fetching published updates, run `git pull --ff-only` before building, but
only after saving/committing your own work. Do not discard local changes to
force an update. If the dependency manifests changed, run `npm ci` again
before building. A tunnel still pointing at port 8127 can remain running
during a server restart, but players must reconnect afterward.

### Troubleshooting

* **"Couldn't connect to server":** Confirm the server terminal says it is
  listening on port 8127. For remote play, confirm the tunnel is also running
  and both players are using its latest HTTPS link. Verify the host has not
  slept or lost internet.
* **Chrome cannot connect locally:** Allow local-network/local-device access
  for the hosted `psim.us` site when prompted. Check Chrome's site permissions
  and macOS local-network permissions if access was previously denied.
  Do not disable browser security globally.
* **Check server versus tunnel:** On the host, open
  `http://127.0.0.1:8127/showdown/info`. It should return JSON containing
  `"websocket":true`. For remote play, also check
  `https://YOUR-CURRENT-TUNNEL.trycloudflare.com/showdown/info`, substituting
  the actual tunnel hostname. If only the public check fails, inspect the
  tunnel terminal. Successful HTTP checks alone do not prove the browser's
  live connection works; confirm the lab loads and lets you choose a name.
* **Port already in use / `EADDRINUSE`:** Do not start a second copy. Use
  `lsof -nP -iTCP:8127 -sTCP:LISTEN` to inspect the listener, then identify
  and stop only your old server before restarting. If you intentionally
  choose another port, update both the local URL and tunnel command.
* **Friend cannot be challenged:** Both players need usernames, six completed
  fusions, and a connection to the same server. Finish/forfeit active Chimera
  battles, cancel other pending challenges, and check challenge-blocking
  settings.
* **"Control is out of date":** Reopen `/chimera` and use the current buttons.
* **No extra type badge in battle:** The native client may omit a type-change
  badge when the fusion's typing matches its displayed base species. Matching
  parent types also collapse to one type; the fusion is not typeless.

### Persistence and technical notes

Drafts are in memory and are cleared on disconnect/server restart. Native
battle rooms follow Showdown's normal reconnect, forfeit, timer and cleanup
behavior, but active battles do not survive a server shutdown. There is no
saved-draft or resume-after-restart feature; avoid disconnecting while drafting.
Serialized fusion nicknames beginning with `C` encode the parents, generated-set
seed, stat split and type choices so packed teams survive serialization. Native
battles display blended names instead (Kyurem + Infernape becomes **Kyrnape**),
and announce the full pair on switch-in. Names blend a first-half stem from
Parent A (smoothing adjacent vowels) with the last half of Parent B's base name,
omitting form suffixes.
Do not rename the serialized recipes; they depend on this fork's parent-pool/set-data version.

### Developer validation

Focused validation (using the same Node.js version, after building):

```sh
npm run tsc
npx mocha --no-config --exit --timeout 15000 test/main.js \
  test/sim/misc/chimera.js test/server/chimera-battle.js \
  test/server/chat-plugins/chimera.js test/server/chat-plugins/chimera-multiplayer.js
```


Documentation quick links
------------------------------------------------------------------------

* [PROTOCOL.md][4] - How the client and server communicate with each other.
* [sim/SIM-PROTOCOL.md][5] - The part of the protocol used for battles and battle messages.
* [CONTRIBUTING.md][6] - Useful code standards to understand if you want to send pull requests to PS (not necessary if you're just using the code and not planning to contribute back).
* [ARCHITECTURE.md][7] - A high-level overview of how the code works.
* [Bot FAQ][8] - An FAQ compiled by Kaiepi regarding making Pokemon Showdown bots - mainly chatbots and battle bots.

  [4]: ./PROTOCOL.md
  [5]: ./sim/SIM-PROTOCOL.md
  [6]: ./CONTRIBUTING.md
  [7]: ./ARCHITECTURE.md
  [8]: https://gist.github.com/Kaiepi/becc5d0ecd576f5e7733b57b4e3fa97e


Community
------------------------------------------------------------------------

PS has a built-in chat service. Join our main server to talk to us!

You can also visit the [Pokémon Showdown forums][9] for discussion and help.

  [9]: https://www.smogon.com/forums/forums/pok%C3%A9mon-showdown.209/

If you'd like to contribute to programming and don't know where to start, feel free to check out [Ideas for New Developers][10].

  [10]: https://github.com/smogon/pokemon-showdown/issues/2444


License
------------------------------------------------------------------------

Pokémon Showdown's server is distributed under the terms of the [MIT License][11].

  [11]: ./LICENSE


Credits
------------------------------------------------------------------------

Owner

- Guangcong Luo [Zarel] - Development, Design, Sysadmin

Staff

- Andrew Werner [HoeenHero] - Development
- Annika L. [Annika] - Development
- Chris Monsanto [chaos] - Development, Sysadmin
- Kris Johnson [dhelmise] - Development
- Leonard Craft III [DaWoblefet] - Research (game mechanics)
- Mathieu Dias-Martins [Marty-D] - Research (game mechanics), Development
- Mia A [Cassiopeia] - Development

Contributors

- See http://pokemonshowdown.com/credits
