'use strict';

const assert = require('assert').strict;
const {
	CHIMERA_STATS, ChimeraDraft, chimeraSpecies, createChimera, decodeChimera, encodeChimera,
	getChimeraName, getChimeraParent, getChimeraPool, validateChimeraSet, validateChimeraTeam,
} = require('../../../dist/sim/chimera');
const { PRNG } = require('../../../dist/sim/prng');
const { Teams } = require('../../../dist/sim/teams');
const { TeamValidator } = require('../../../dist/sim/team-validator');
const { Battle } = require('../../../dist/sim/battle');

describe('Chimera drafting and validation', () => {
	function draft() {
		return new ChimeraDraft(new PRNG('1,2,3,4'));
	}

	function build(a = 'Samurott', b = 'Samurott-Hisui', mask = 7, types = [0, 0]) {
		const parents = [Dex.species.get(a), Dex.species.get(b)];
		const seed = 123456;
		const parent = getChimeraParent(parents[0], seed);
		return createChimera({ parents, seed, mask, types }, parents[0].abilities[0], parent.item, parent.moves);
	}

	it('should include fully evolved Gen 9 legends, Paradox and distinct regional forms only', () => {
		const pool = getChimeraPool();
		for (const id of ['samurott', 'samurotthisui', 'mewtwo', 'ironbundle', 'miraidon']) {
			assert(pool.some(species => species.id === id), id);
		}
		for (const species of pool) {
			assert(!species.nfe && !species.battleOnly && !species.isNonstandard);
			assert(!species.requiredItem && !species.requiredItems && !species.requiredMove);
		}
		assert(!pool.some(species => ['caterpie', 'charizardmegax', 'ogerponwellspringtera'].includes(species.id)));
	});

	it('should generate reproducible four-move sets without Tera-only roles for every parent', function () {
		this.timeout(15000);
		for (const species of getChimeraPool()) {
			const parent = getChimeraParent(species, 123456);
			assert(parent.moves.length > 0 && parent.moves.length <= 4, species.name);
			assert.deepEqual(parent, getChimeraParent(species, 123456));
			assert(!Dex.items.get(parent.item).megaStone && !Dex.items.get(parent.item).zMove);
		}
	});

	it('should round-trip recipes through packed and exported Showdown teams', () => {
		const set = build();
		assert(set.name.length <= 20);
		assert.equal(encodeChimera(decodeChimera(set.name)), set.name);
		assert.deepEqual(validateChimeraSet(Teams.unpack(Teams.pack([set]))[0]), []);
		assert.deepEqual(validateChimeraSet(Teams.import(Teams.export([set]))[0]), []);
		assert.equal(chimeraSpecies(decodeChimera(set.name)).types.length, 1);
	});

	it('should inherit exactly three distinct stats from each parent and one type from each', () => {
		const set = build('Charizard', 'Blastoise', 21, [1, 0]);
		const recipe = decodeChimera(set.name);
		const species = chimeraSpecies(recipe);
		for (const [i, stat] of CHIMERA_STATS.entries()) {
			assert.equal(species.baseStats[stat], recipe.parents[21 & (1 << i) ? 0 : 1].baseStats[stat]);
		}
		assert.deepEqual(species.types, ['Flying', 'Water']);
		assert.throws(() => build('Charizard', 'Blastoise', 63), /assignment/);
		assert.throws(() => build('Charizard', 'Blastoise', 3), /assignment/);
		assert.throws(() => build('Charizard', 'Blastoise', 7, [0, 1]), /assignment/);
		assert.throws(() => build('Charizard', 'Charizard'), /assignment/);
	});

	it('should reject malformed, out-of-range and edited recipes', () => {
		for (const name of ['', 'Chimera', 'Czzzzzzzzzzzzzzzz', 'C<script>', `${build().name}x`]) {
			assert.equal(decodeChimera(name), null);
		}
		const set = build();
		for (const patch of [
			{ ability: 'Wonder Guard' }, { item: 'Master Ball' }, { moves: ['Splash'] },
			{ moves: [] }, { moves: Array(5).fill(set.moves[0]) }, { species: 'Mewtwo' },
			{ nature: 'Adamant' }, { level: 99 }, { ivs: { ...set.ivs, hp: 0 } },
			{ evs: { ...set.evs, atk: 252 } },
		]) {
			assert(validateChimeraSet({ ...set, ...patch }).length, JSON.stringify(patch));
		}
	});

	it('should accept an ability and item from B and a mixed set of moves', () => {
		const set = build();
		const recipe = decodeChimera(set.name);
		const b = getChimeraParent(recipe.parents[1], recipe.seed);
		const moves = [...new Set([set.moves[0], ...b.moves])].slice(0, 4);
		assert.deepEqual(validateChimeraSet({
			...set, ability: recipe.parents[1].abilities[0], item: b.item, moves,
		}), []);
	});

	it('should allow exactly two whole-draw rerolls and invalidate old draws', () => {
		const game = draft();
		const oldSeed = game.seed;
		game.reroll();
		game.reroll();
		assert.notEqual(game.seed, oldSeed);
		assert.equal(game.rerolls, 0);
		assert.equal(game.revision, 2);
		assert.throws(() => game.reroll(), /No rerolls/);
	});

	it('should complete six rounds using twelve unique exact forms and forbid a seventh fusion', () => {
		const game = draft();
		const team = game.finishForCPU();
		assert.equal(team.length, 6);
		assert.equal(game.used.size, 12);
		assert.deepEqual(validateChimeraTeam(team), []);
		assert.equal(new TeamValidator('gen9chimera').validateTeam(Teams.unpack(Teams.pack(team))), null);
		assert.throws(() => game.draw(), /complete/);
		assert.throws(() => game.reroll(), /No rerolls/);
		assert.throws(() => game.add(0, 1, 7, [0, 0], '', '', []), /Choose two/);
	});

	it('should reject reused parents, incomplete teams and out-of-draw selections without mutating the draft', () => {
		const game = draft();
		assert.throws(() => game.add(0, 3, 7, [0, 0], '', '', []), /current draw/);
		assert.equal(game.team.length, 0);
		const team = game.finishForCPU();
		assert(validateChimeraTeam(team.slice(1)).some(problem => problem.includes('six')));
		assert(validateChimeraTeam([team[0], ...team.slice(0, 5)]).some(problem => problem.includes('already')));
		assert(new TeamValidator('gen9chimera').validateTeam(null).length);
	});

	it('should apply fusion stats/types in battle, retain them across form changes and disable gimmicks', () => {
		const team = draft().finishForCPU();
		const battle = new Battle({
			formatid: 'gen9chimera', p1: { name: 'P1', team }, p2: { name: 'P2', team: Dex.deepClone(team) },
		});
		try {
			battle.makeChoices('default', 'default');
			const active = battle.p1.active[0];
			const species = chimeraSpecies(decodeChimera(active.set.name));
			assert.notEqual(active.name, active.set.name);
			assert.equal(active.name, getChimeraName(decodeChimera(active.set.name)));
			assert(active.name.length <= 20);
			assert(decodeChimera(active.set.name));
			assert.deepEqual(active.species.baseStats, species.baseStats);
			assert.deepEqual(active.getTypes(), species.types);
			assert.equal(active.maxhp, 2 * species.baseStats.hp + 31 + Math.floor(85 / 4) + 110);
			assert(!battle.p1.activeRequest.active[0].canTerastallize);
			assert(!battle.p1.activeRequest.active[0].canMegaEvo);
			assert(!battle.p1.activeRequest.active[0].canZMove);
			active.formeChange('Palafin-Hero', Dex.abilities.get('Zero to Hero'), true);
			assert.deepEqual(active.species.baseStats, species.baseStats);
			assert.deepEqual(active.getTypes(), species.types);
		} finally {
			battle.destroy();
		}
	});

	it('should blend parent names, including Kyurem + Infernape into Kyrnape', () => {
		const set = build('Kyurem', 'Infernape');
		assert.equal(getChimeraName(decodeChimera(set.name)), 'Kyrnape');
		const regional = build('Samurott-Hisui', 'Infernape');
		assert.equal(getChimeraName(decodeChimera(regional.name)), 'Samunape');
		for (const parent of getChimeraPool()) {
			const recipe = decodeChimera(build(parent.name, parent.id === 'infernape' ? 'Kyurem' : 'Infernape').name);
			assert(getChimeraName(recipe).length > 0 && getChimeraName(recipe).length <= 20);
		}
	});

	it('should not reveal a fusion hidden behind Illusion in its switch-in announcement', () => {
		const first = build('Zoroark', 'Infernape');
		const last = build('Lugia', 'Amoonguss');
		const team = [first, ...draft().finishForCPU().slice(0, 4), last];
		const battle = new Battle({
			formatid: 'gen9chimera',
			p1: { name: 'P1', team },
			p2: { name: 'P2', team: draft().finishForCPU() },
		});
		try {
			battle.makeChoices('default', 'default');
			assert(battle.p1.active[0].illusion);
			assert(battle.log.some(line => line.includes('Lugia + Amoonguss')));
			assert(!battle.log.some(line => line.includes('Zoroark + Infernape')));
		} finally {
			battle.destroy();
		}
	});
});
