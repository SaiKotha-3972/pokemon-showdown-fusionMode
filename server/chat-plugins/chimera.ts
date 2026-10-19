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
}

export const sessions = new WeakMap<User, ChimeraSession>();
const STAT_LABELS = ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed'];
const PANEL = `border:1px solid #758399;border-radius:12px;padding:16px;margin:12px 0`;

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

function renderChimeraPage(session?: ChimeraSession): string {
	let html = `<div class="pad" style="max-width:1100px;margin:auto"><h1>Chimera Battle Lab</h1>`;
	html += `<p>Gen 9 fusion draft | six vs six | CPU battles</p>`;
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
	if (battle) {
		html += `<h2>${battle.ended ? 'Battle finished' : 'Your battle is in progress'}</h2>`;
		html += Utils.html`<p><a class="button" href="/${battleRoom.roomid}">Open Showdown battle</a></p>`;
		if (battle.ended) html += `<p>${button('Rematch with this team', 'battle', draft.revision)}</p>`;
	} else if (draft.team.length < 6) {
		html += renderDraft(session);
	} else {
		html += `<h2>Your team is ready</h2><p>${button('Battle the CPU', 'battle', draft.revision)}</p>`;
	}
	html += `<details${battle ? '' : ' open'}><summary>Your fusions (${draft.team.length} / 6)</summary>`;
	html += renderTeam(draft.team) + `</details></div>`;
	return html;
}

export function renderChimera(session?: ChimeraSession): string {
	// pagehtml is a single protocol line; literal newlines truncate the page in the client.
	return renderChimeraPage(session).replace(/\n/g, '');
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
				if (action === 'battle') {
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
		`/chimera - Open the Chimera draft builder, then battle a CPU in a standard Showdown battle room.`,
		`Build six fusions from twelve distinct parent forms, with two rerolls per draft.`,
	],
};

export const pages: Chat.PageTable = {
	chimera(query, user) {
		this.title = '[Chimera] Battle Lab';
		return renderChimera(sessions.get(user));
	},
};

export const handlers: Chat.Handlers = {
	onBattleEnd(battle) {
		if (battle.format !== CHIMERA_FORMAT || !battle.cpu) return;
		battle.room.add(
			`|html|<div class="infobox"><button class="button" name="send" value="/chimera">` +
			`Return to Chimera builder / rematch</button></div>`
		);
	},
	onDisconnect(user) {
		sessions.delete(user);
	},
};
