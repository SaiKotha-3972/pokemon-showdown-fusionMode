import { Utils } from '../../lib';
import {
	CHIMERA_FORMAT, CHIMERA_STATS, ChimeraDraft, ChimeraError, chimeraSpecies, decodeChimera,
	getChimeraName, validateChimeraTeam,
} from '../../sim/chimera';

interface ChimeraSession {
	draft: ChimeraDraft;
	parents: number[];
	battleRoom?: RoomID;
	error?: string;
	challenge?: ChimeraChallenge;
}

interface ChimeraChallenge {
	from: User;
	to: User;
	expires: number;
	timer: NodeJS.Timeout;
}

export const sessions = new WeakMap<User, ChimeraSession>();
const STAT_LABELS = ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed'];
const PANEL = `border:1px solid #758399;border-radius:12px;padding:16px;margin:12px 0`;

function refreshBuilder(user: User) {
	for (const connection of user.connections) {
		if (connection.openPages?.has('chimera')) {
			connection.send(`>view-chimera\n|pagehtml|${renderChimera(sessions.get(user), user)}`);
		}
	}
}

function clearChallenge(challenge: ChimeraChallenge, message?: string) {
	clearTimeout(challenge.timer);
	for (const user of [challenge.from, challenge.to]) {
		const session = sessions.get(user);
		if (session?.challenge !== challenge) continue;
		session.challenge = undefined;
		session.draft.revision++;
		if (message) session.error = message;
		refreshBuilder(user);
	}
}

function requireReady(user: User): ChimeraSession {
	const session = sessions.get(user);
	if (!user.connected || !user.named || !session) {
		throw new ChimeraError(`${user.name} must be online with a Chimera draft.`);
	}
	if (session.battleRoom && Rooms.get(session.battleRoom)?.battle?.ended === false) {
		throw new ChimeraError(`${user.name}: Finish or forfeit your current battle first.`);
	}
	const problems = validateChimeraTeam(session.draft.team);
	if (problems.length) throw new ChimeraError(`${user.name}: ${problems.join(' ')}`);
	return session;
}

function button(label: string, action: string, revision: number, args = ''): string {
	return Utils.html`<button class="button" name="send" value="/chimera ${action} ${revision}${args ? `,${args}` : ''}">${label}</button>`;
}

function options(values: string[], selected = 0): string {
	return values.map((value, i) => (
		Utils.html`<option value="${value}"${i === selected ? ' selected' : ''}>${value || '(none)'}</option>`
	)).join('');
}

function parentLabel(set: PokemonSet): string {
	const recipe = decodeChimera(set.name);
	return recipe ? recipe.parents.map(parent => parent.name).join(' + ') : set.species;
}

function renderTeam(team: PokemonSet[]): string {
	return team.map((set, i) => {
		const recipe = decodeChimera(set.name)!;
		const species = chimeraSpecies(recipe);
		return Utils.html`<div style="${PANEL}"><strong>${i + 1}. ${getChimeraName(recipe)}</strong>
			<br />Parents: ${parentLabel(set)}
			<br />${species.types.join(' / ')} | ${set.ability} | ${set.item || '(no item)'}
			<br />${CHIMERA_STATS.map((stat, j) => `${STAT_LABELS[j]} ${species.baseStats[stat]}`).join(' / ')}
			<br />${set.moves.join(' / ')}</div>`;
	}).join('');
}

function renderDraft(session: ChimeraSession): string {
	const { draft, parents } = session;
	let html = `<h2>Draft ${draft.team.length + 1} / 6</h2><p>Choose two parents, then build one fusion.</p>`;
	html += `<p>${button(`Reroll all three (${draft.rerolls} left)`, 'reroll', draft.revision)}</p>`;
	html += `<div style="display:flex;flex-wrap:wrap;gap:12px">`;
	for (const [i, parent] of draft.candidates.entries()) {
		const species = parent.species;
		const selected = parents.indexOf(i);
		html += Utils.html`<div style="${PANEL};flex:1;min-width:200px">
			<psicon pokemon="${species.name}" /><h3>${species.name}</h3>
			<p>${species.types.join(' / ')} | BST ${species.bst}</p>
			<p>${CHIMERA_STATS.map((stat, j) => `${STAT_LABELS[j]} ${species.baseStats[stat]}`).join(' / ')}</p>
			<p>Abilities: ${Object.values(species.abilities).join(' / ')}</p>
			<p>Item: ${parent.item || '(none)'}</p><p>Moves: ${parent.moves.join(' / ')}</p>`;
		html += button(selected < 0 ? 'Choose parent' : `Parent ${selected === 0 ? 'A' : 'B'} (deselect)`,
			'parent', draft.revision, String(i));
		html += `</div>`;
	}
	html += `</div>`;
	if (parents.length !== 2) return html;
	const a = draft.candidates[parents[0]];
	const b = draft.candidates[parents[1]];
	html += `<div style="${PANEL}"><h2>Build your fusion</h2>`;
	html += `<p>Assign exactly three stats to A; the other three come from B. Each stat is assigned once.</p>`;
	html += `<form data-submitsend="/chimera add ${draft.revision},{hp},{atk},{def},{spa},{spd},{spe},{typea},{typeb},{ability},{item},{move1},{move2},{move3},{move4}">`;
	html += `<table><thead><tr><th>Stat</th><th>Take from</th></tr></thead><tbody>`;
	for (const [i, stat] of CHIMERA_STATS.entries()) {
		html += Utils.html`<tr><td>${STAT_LABELS[i]} </td><td><select name="${stat}">
			<option value="0"${i < 3 ? ' selected' : ''}>A: ${a.species.baseStats[stat]}</option>
			<option value="1"${i >= 3 ? ' selected' : ''}>B: ${b.species.baseStats[stat]}</option>
			</select></td></tr>`;
	}
	html += `</tbody></table><p>`;
	for (const [i, parent] of [a, b].entries()) {
		html += `Type from ${i ? 'B' : 'A'}: <select name="type${i ? 'b' : 'a'}">`;
		html += parent.species.types.map((type, j) => Utils.html`<option value="${j}">${type}</option>`).join('');
		html += `</select> `;
	}
	const abilities = [...new Set([...Object.values(a.species.abilities), ...Object.values(b.species.abilities)])];
	html += `</p><p>Ability: <select name="ability">${options(abilities)}</select></p>`;
	html += `<p>Held item: <select name="item">${options([...new Set([a.item, b.item])])}</select></p>`;
	const moves = [...new Set([...a.moves, ...b.moves])];
	html += `<p>Pick one to four different moves from the two parent sets:</p>`;
	for (let i = 0; i < 4; i++) {
		html += `<p>Move ${i + 1}: <select name="move${i + 1}">${options(['', ...moves], i + 1)}</select></p>`;
	}
	html += `<button type="submit" class="button notifying">Add fusion and draw next round</button></form></div>`;
	return html;
}

function renderChimeraPage(session?: ChimeraSession, user?: User): string {
	let html = `<div class="pad" style="max-width:1100px;margin:auto"><h1>Chimera Battle Lab</h1>`;
	html += `<p>Gen 9 fusion draft | six vs six | CPU or friend battles</p>`;
	html += `<details><summary>Rules</summary><p>Six rounds; draw three and choose two per fusion.
		Two rerolls total per draft. No repeated parent forms across your team; regional and alternate forms
		count separately. Fully evolved Gen 9 parents with supported sets, including legendaries and Paradox.
		Take exactly three distinct stats from each parent, one type from each (matching types become monotype),
		any ability from either, one of their two held items, and one to four moves from their generated sets.
		Level 100, neutral nature, 31 IVs and 85 EVs per stat. No Tera, Mega Evolution, Z-Moves or Dynamax.
		The CPU drafts independently. Drafts are temporary and end when you disconnect or the server restarts.
		Battles open in the standard animated Showdown battle interface.</p></details>`;
	if (!session) {
		return html + `<p><button class="button notifying" name="send" value="/chimera new">Start a draft</button></p></div>`;
	}
	if (session.error) html += Utils.html`<div class="message-error" style="${PANEL}">${session.error}</div>`;
	const { draft } = session;
	const battleRoom = session.battleRoom ? Rooms.get(session.battleRoom) : undefined;
	const battle = battleRoom?.battle;
	html += `<p>${button('New draft (discard current)', 'new', draft.revision)}</p>`;
	if (session.challenge) {
		const challenge = session.challenge;
		const incoming = challenge.to === user;
		html += Utils.html`<h2>${incoming ? `Challenge from ${challenge.from.name}` : `Waiting for ${challenge.to.name}`}</h2>`;
		html += `<p>Both teams are locked until this challenge is accepted, cancelled, or expires after five minutes.</p>`;
		if (incoming) html += `<p>${button('Accept friend challenge', 'accept', draft.revision)}</p>`;
		html += `<p>${button(incoming ? 'Decline challenge' : 'Cancel challenge', 'cancel', draft.revision)}</p>`;
	} else if (battle) {
		html += `<h2>${battle.ended ? 'Battle finished' : 'Your battle is in progress'}</h2>`;
		html += Utils.html`<p><a class="button" href="/${battleRoom.roomid}">Open Showdown battle</a></p>`;
		if (battle.ended) {
			html += `<p>${button(battle.cpu ? 'Rematch with this team' : 'Battle the CPU', 'battle', draft.revision)}</p>`;
		}
	} else if (draft.team.length < 6) {
		html += renderDraft(session);
	} else {
		html += `<h2>Your team is ready</h2><p>${button('Battle the CPU', 'battle', draft.revision)}</p>`;
	}
	if (!session.challenge && draft.team.length === 6 && (!battle || battle.ended)) {
		html += `<h3>Play a friend</h3><p>Your friend must be online on this same server with six drafted fusions.</p>`;
		html += `<form data-submitsend="/chimera challenge ${draft.revision},{friend}">`;
		html += `<label>Friend's username: <input name="friend" maxlength="18" required /></label> `;
		html += `<button type="submit" class="button notifying">Challenge a friend</button></form>`;
	}
	html += `<details${battle ? '' : ' open'}><summary>Your fusions (${draft.team.length} / 6)</summary>`;
	html += renderTeam(draft.team) + `</details></div>`;
	return html;
}

export function renderChimera(session?: ChimeraSession, user?: User): string {
	// pagehtml is a single protocol line; literal newlines truncate the page in the client.
	return renderChimeraPage(session, user).replace(/\n/g, '');
}

export const commands: Chat.ChatCommands = {
	chimera(target, room, user) {
		if (!user.named) throw new Chat.ErrorMessage(`Choose a username before starting Chimera.`);
		if (!target.trim()) {
			this.closePage('chimera');
			return this.parse('/join view-chimera');
		}
		const space = target.indexOf(' ');
		const action = space < 0 ? target : target.slice(0, space);
		const args = space < 0 ? [] : target.slice(space + 1).split(',').map(value => value.trim());
		let session = sessions.get(user);
		try {
			if (session) session.error = undefined;
			if (session && args[0] !== String(session.draft.revision)) {
				throw new ChimeraError(`This control is out of date. Refresh the Chimera page and try again.`);
			}
			if (session?.challenge && !['accept', 'cancel'].includes(action)) {
				throw new ChimeraError(`Accept, decline, or cancel your pending challenge before changing your team or battling.`);
			}
			if (action === 'new') {
				const revision = (session?.draft.revision ?? -1) + 1;
				if (session?.battleRoom && Rooms.get(session.battleRoom)?.battle?.ended === false) {
					throw new ChimeraError(`Finish or forfeit your current battle before starting a new draft.`);
				}
				session = { draft: new ChimeraDraft(), parents: [] };
				session.draft.revision = revision;
				sessions.set(user, session);
			} else {
				if (!session) throw new ChimeraError(`Start a draft with /chimera first.`);
				const { draft } = session;
				if (action === 'cancel') {
					if (!session.challenge) throw new ChimeraError(`There is no pending challenge.`);
					clearChallenge(session.challenge, `The Chimera challenge was cancelled or declined.`);
				} else if (action === 'accept') {
					const challenge = session.challenge;
					if (!challenge || challenge.to !== user) throw new ChimeraError(`There is no incoming challenge to accept.`);
					if (challenge.expires <= Date.now()) {
						clearChallenge(challenge, `The Chimera challenge expired.`);
						throw new ChimeraError(`The Chimera challenge expired.`);
					}
					const from = requireReady(challenge.from);
					const to = requireReady(user);
					if (from.challenge !== challenge || to.challenge !== challenge) {
						throw new ChimeraError(`This challenge is no longer available.`);
					}
					const battleRoom = Rooms.createBattle({
						format: CHIMERA_FORMAT,
						players: [
							{ user: challenge.from, team: Teams.pack(from.draft.team) },
							{ user, team: Teams.pack(to.draft.team) },
						],
						rated: false,
						allowRenames: false,
					});
					if (!battleRoom) throw new ChimeraError(`The server cannot start a battle right now. Try again shortly.`);
					from.battleRoom = to.battleRoom = battleRoom.roomid;
					clearChallenge(challenge);
					return;
				} else if (action === 'challenge') {
					requireReady(user);
					const friend = Users.get(args[1] || '');
					if (!friend?.connected || !friend.named) throw new ChimeraError(`Your friend must be online on this server.`);
					if (friend === user) throw new ChimeraError(`You cannot challenge yourself.`);
					const friendSession = requireReady(friend);
					if (friendSession.challenge) throw new ChimeraError(`${friend.name} already has a pending Chimera challenge.`);
					const blocks = friend.settings.blockChallenges;
					const blocked = typeof blocks === 'boolean' ? blocks :
						blocks === 'friends' ? !friend.friends?.has(user.id) : !Users.globalAuth.atLeast(user, blocks);
					if (blocked && !user.can('bypassblocks', friend)) {
						throw new ChimeraError(`${friend.name} is not accepting challenges right now.`);
					}
					if (!Config.nothrottle && Date.now() < user.lastChallenge + 10000) {
						throw new ChimeraError(`Please wait ten seconds between challenges.`);
					}
					user.lastChallenge = Date.now();
					const challenge: ChimeraChallenge = {
						from: user, to: friend, expires: Date.now() + 5 * 60 * 1000,
						timer: setTimeout(() => clearChallenge(challenge, `The Chimera challenge expired.`), 5 * 60 * 1000),
					};
					challenge.timer.unref();
					session.challenge = friendSession.challenge = challenge;
					friendSession.error = undefined;
					draft.revision++;
					friendSession.draft.revision++;
					refreshBuilder(friend);
					friend.popup(`${user.name} challenged you to Chimera! Open /chimera to accept or decline (expires in five minutes).`);
				} else if (action === 'battle') {
					if (draft.team.length !== 6) throw new ChimeraError(`Build six fusions first.`);
					if (session.battleRoom && Rooms.get(session.battleRoom)?.battle?.ended === false) {
						throw new ChimeraError(`Finish or forfeit your current battle first.`);
					}
					const problems = validateChimeraTeam(draft.team);
					if (problems.length) throw new ChimeraError(problems.join(' '));
					const battleRoom = Rooms.createBattle({
						format: CHIMERA_FORMAT,
						players: [{ user, team: Teams.pack(draft.team) }],
						cpu: { name: 'Chimera CPU', team: Teams.pack(new ChimeraDraft().finishForCPU()) },
						rated: false,
						allowRenames: false,
					});
					if (!battleRoom) throw new ChimeraError(`The server cannot start a battle right now. Please try again shortly.`);
					session.battleRoom = battleRoom.roomid;
					draft.revision++;
					return;
				} else {
					if (session.battleRoom) throw new ChimeraError(`Start a new draft to change your team.`);
					if (action === 'reroll') {
						draft.reroll();
						session.parents = [];
					} else if (action === 'parent') {
						const index = Number(args[1]);
						if (!Number.isInteger(index) || !draft.candidates[index] || draft.team.length >= 6) {
							throw new ChimeraError(`Choose a parent from the current draw.`);
						}
						if (session.parents.includes(index)) {
							session.parents = session.parents.filter(parent => parent !== index);
						} else {
							if (session.parents.length === 2) throw new ChimeraError(`Deselect a parent before choosing another.`);
							session.parents.push(index);
						}
						draft.revision++;
					} else if (action === 'add') {
						if (session.parents.length !== 2 || args.length !== 15 ||
							args.slice(1, 7).some(value => value !== '0' && value !== '1')) {
							throw new ChimeraError(`Choose two parents and assign all six stats.`);
						}
						const mask = args.slice(1, 7).reduce((value, parent, i) => value | (parent === '0' ? 1 << i : 0), 0);
						draft.add(session.parents[0], session.parents[1], mask,
							[Number(args[7]), Number(args[8])], args[9], args[10], args.slice(11, 15).filter(Boolean));
						session.parents = [];
					} else {
						throw new ChimeraError(`Unknown Chimera action. Use /chimera to open the builder.`);
					}
				}
			}
		} catch (error) {
			if (!(error instanceof ChimeraError)) throw error;
			if (session) session.error = error.message;
			this.refreshPage('chimera');
			throw new Chat.ErrorMessage(error.message);
		}
		return this.parse('/join view-chimera');
	},
	chimerahelp: [
		`/chimera - Open the Chimera draft builder, then battle a CPU or challenge a friend on the same server.`,
		`Build six fusions from twelve distinct parent forms, with two rerolls per draft.`,
	],
};

export const pages: Chat.PageTable = {
	chimera(query, user) {
		this.title = '[Chimera] Battle Lab';
		return renderChimera(sessions.get(user), user);
	},
};

export const handlers: Chat.Handlers = {
	onBattleEnd(battle) {
		if (battle.format !== CHIMERA_FORMAT) return;
		battle.room.add(
			`|html|<div class="infobox"><button class="button" name="send" value="/chimera">` +
			`Return to Chimera builder / rematch</button></div>`
		);
	},
	onDisconnect(user) {
		const challenge = sessions.get(user)?.challenge;
		if (challenge) clearChallenge(challenge, `${user.name} disconnected. The Chimera challenge was cancelled.`);
		sessions.delete(user);
	},
};
