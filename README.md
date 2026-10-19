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

This fork includes **[Gen 9] Chimera**, a six-fusion draft and CPU battle mode.
With Node.js **22.18+** (24 LTS recommended):

```sh
npm ci
npm run build
npm start
```

Open `http://localhost:8000`, choose a username, and enter `/chimera` in chat.
The draft builder opens in a Showdown page; no separate client checkout is
required. Select **Start a draft**, build six fusions, then select **Battle the
CPU**. This opens a **standard Showdown battle room**, with the same animated
battlefield, sprites, team preview, move buttons, switching controls and battle
log as Random Battle. Moves and switches use the real Showdown simulator,
including abilities, items, status, hazards, accuracy and PP.

Rules:

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
search AI. After the battle, use **Return to Chimera builder / rematch** and then
**Rematch with this team** for another CPU battle (not the client's regular
human challenge/rematch button). Human-vs-human matchmaking is not implemented.

Drafts are in memory and are cleared on disconnect/server restart. Native
battle rooms follow Showdown's normal reconnect, forfeit, timer and cleanup
behavior. Finish or forfeit a battle before starting another draft.
Serialized fusion nicknames beginning with `C` encode the parents, generated-set
seed, stat split and type choices so packed teams survive serialization. Native
battles display blended names instead (Kyurem + Infernape becomes **Kyrnape**),
and announce the full pair on switch-in. Names blend a first-half stem from
Parent A (smoothing adjacent vowels) with the last half of Parent B's base name,
omitting form suffixes.
Do not rename the serialized recipes; they depend on this fork's parent-pool/set-data version.

Focused validation (using the same Node.js version):

```sh
npm run tsc
npx mocha --no-config --exit --timeout 15000 test/main.js \
  test/sim/misc/chimera.js test/server/chimera-battle.js \
  test/server/chat-plugins/chimera.js
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
