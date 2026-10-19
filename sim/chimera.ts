import { Dex, toID } from './dex';
import { PRNG } from './prng';
import RandomTeams from '../data/random-battles/gen9/teams';
import parentSets from '../data/random-battles/gen9/sets.json';

export const CHIMERA_STATS: StatID[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const CHIMERA_FORMAT = 'gen9chimera';

export class ChimeraError extends Error {}

export interface ChimeraParent {
	species: Species;
	moves: string[];
	item: string;
}

export interface ChimeraRecipe {
	seed: number;
	parents: [Species, Species];
	mask: number;
	types: [number, number];
}

let pool: Species[] | undefined;

/** A stable, sorted pool keeps the recipe small enough for a Showdown nickname. */
export function getChimeraPool(): Species[] {
	if (!pool) {
		const dex = Dex.mod('gen9');
		pool = Object.keys(parentSets).map(id => dex.species.get(id)).filter(species => (
			species.exists && !species.nfe && !species.isNonstandard && !species.battleOnly &&
			!species.requiredItem && !species.requiredItems && !species.requiredMove
		)).sort((a, b) => a.id.localeCompare(b.id));
		if (pool.length < 15 || pool.length >= 36 ** 2) throw new Error(`Invalid Chimera parent pool size.`);
	}
	return pool;
}

export function getChimeraParent(species: Species, seed: number): ChimeraParent {
	// Recreate each set independently so candidate order cannot change the offered moves or item.
	const generator = new RandomTeams('gen9chimeraparents', `gen5,00000000${seed.toString(16).padStart(8, '0')}`);
	const set = generator.randomSet(species);
	return { species, moves: set.moves.map(move => Dex.moves.get(move).name), item: set.item };
}

export function encodeChimera(recipe: ChimeraRecipe): string {
	const ids = recipe.parents.map(parent => getChimeraPool().findIndex(species => species.id === parent.id));
	if (ids.some(id => id < 0) || !Number.isInteger(recipe.seed) || recipe.seed < 0 || recipe.seed > 0xFFFFFFFF) {
		throw new ChimeraError(`Invalid Chimera parents or seed.`);
	}
	const name = `C${recipe.seed.toString(36).padStart(7, '0')}` +
		ids.map(id => id.toString(36).padStart(2, '0')).join('') +
		recipe.mask.toString(36).padStart(2, '0') + recipe.types.join('');
	if (!decodeChimera(name)) throw new ChimeraError(`Invalid Chimera stat or type assignment.`);
	return name;
}

export function decodeChimera(name: string): ChimeraRecipe | null {
	const match = /^C([0-9a-z]{7})([0-9a-z]{2})([0-9a-z]{2})([0-9a-z]{2})([01])([01])$/.exec(name);
	if (!match) return null;
	const seed = parseInt(match[1], 36);
	const a = getChimeraPool()[parseInt(match[2], 36)];
	const b = getChimeraPool()[parseInt(match[3], 36)];
	const mask = parseInt(match[4], 36);
	const types: [number, number] = [Number(match[5]), Number(match[6])];
	if (
		seed > 0xFFFFFFFF || !a || !b || a.id === b.id || mask > 63 ||
		CHIMERA_STATS.filter((_, i) => mask & (1 << i)).length !== 3 ||
		!a.types[types[0]] || !b.types[types[1]]
	) return null;
	return { seed, parents: [a, b], mask, types };
}

export function chimeraSpecies(recipe: ChimeraRecipe): Species {
	const [a, b] = recipe.parents;
	const species = Dex.deepClone(a);
	for (const [i, stat] of CHIMERA_STATS.entries()) {
		species.baseStats[stat] = (recipe.mask & (1 << i) ? a : b).baseStats[stat];
	}
	species.bst = CHIMERA_STATS.reduce((sum, stat) => sum + species.baseStats[stat], 0);
	species.types = [...new Set(recipe.parents.map((parent, i) => parent.types[recipe.types[i]]))];
	species.weightkg = (a.weightkg + b.weightkg) / 2;
	species.nfe = false;
	species.evos = [];
	return species;
}

export function getChimeraName(recipe: ChimeraRecipe): string {
	const [a, b] = recipe.parents.map(parent => parent.baseSpecies);
	const stem = a.replace(/([aeiouy])[aeiou]+/gi, '$1').slice(0, Math.ceil(a.length / 2));
	return (stem + b.slice(Math.ceil(b.length / 2)).toLowerCase()).slice(0, 20);
}

export function createChimera(
	recipe: ChimeraRecipe, ability: string, item: string, moves: string[]
): PokemonSet {
	const set: PokemonSet = {
		name: encodeChimera(recipe), species: recipe.parents[0].name, ability, item, moves: [...moves],
		nature: 'Serious', gender: '', level: 100,
		ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
		evs: { hp: 85, atk: 85, def: 85, spa: 85, spd: 85, spe: 85 },
	};
	const problems = validateChimeraSet(set);
	if (problems.length) throw new ChimeraError(problems.join(' '));
	return set;
}

export function validateChimeraSet(set: PokemonSet): string[] {
	const recipe = decodeChimera(set.name);
	if (!recipe) return [`Invalid Chimera recipe. Build your team with /chimera.`];
	const problems: string[] = [];
	const parents = recipe.parents.map(parent => getChimeraParent(parent, recipe.seed));
	if (toID(set.species) !== recipe.parents[0].id) problems.push(`The fusion's base must be Parent A.`);
	const abilities = recipe.parents.flatMap(parent => Object.values(parent.abilities)).map(toID);
	if (!abilities.includes(toID(set.ability))) problems.push(`Choose an ability from either parent.`);
	if (!parents.some(parent => toID(parent.item) === toID(set.item))) problems.push(`Choose one of the two parent items.`);
	const item = Dex.items.get(set.item);
	if (item.megaStone || item.zMove) problems.push(`Mega Stones and Z-Crystals are not allowed.`);
	const moves = new Set(parents.flatMap(parent => parent.moves).map(toID));
	if (!set.moves.length || set.moves.length > 4 || new Set(set.moves.map(toID)).size !== set.moves.length) {
		problems.push(`Choose one to four different moves.`);
	}
	if (set.moves.some(move => !moves.has(toID(move)))) problems.push(`Moves must come from the two offered parent sets.`);
	if ((set.level ?? 100) !== 100 || set.nature !== 'Serious') {
		problems.push(`Chimeras must be level 100 with a neutral Serious nature.`);
	}
	if (CHIMERA_STATS.some(stat => (set.ivs?.[stat] ?? 31) !== 31 || set.evs?.[stat] !== 85)) {
		problems.push(`Chimeras require 31 IVs and 85 EVs in every stat.`);
	}
	return problems;
}

export function validateChimeraTeam(team: PokemonSet[]): string[] {
	const problems: string[] = [];
	if (team.length !== 6) problems.push(`A Chimera team must contain six fusions.`);
	const used = new Set<ID>();
	for (const set of team) {
		problems.push(...validateChimeraSet(set));
		const recipe = decodeChimera(set.name);
		if (!recipe) continue;
		for (const parent of recipe.parents) {
			if (used.has(parent.id)) problems.push(`${parent.name} has already been used as a parent.`);
			used.add(parent.id);
		}
	}
	return problems;
}

export class ChimeraDraft {
	readonly prng: PRNG;
	readonly team: PokemonSet[] = [];
	readonly used = new Set<ID>();
	candidates: ChimeraParent[] = [];
	seed = 0;
	rerolls = 2;
	revision = 0;

	constructor(prng = new PRNG()) {
		this.prng = prng;
		this.draw();
	}

	draw() {
		if (this.team.length >= 6) throw new ChimeraError(`Your team is complete.`);
		this.seed = this.prng.random(0x100000000);
		const available = getChimeraPool().filter(species => !this.used.has(species.id));
		this.candidates = [];
		for (let i = 0; i < 3; i++) {
			const index = this.prng.random(available.length);
			const [species] = available.splice(index, 1);
			this.candidates.push(getChimeraParent(species, this.seed));
		}
	}

	reroll() {
		if (!this.rerolls || this.team.length >= 6) throw new ChimeraError(`No rerolls available.`);
		this.rerolls--;
		this.draw();
		this.revision++;
	}

	add(a: number, b: number, mask: number, types: [number, number], ability: string, item: string, moves: string[]) {
		if (this.team.length >= 6 || !Number.isInteger(a) || !Number.isInteger(b) || a === b ||
			!this.candidates[a] || !this.candidates[b]) {
			throw new ChimeraError(`Choose two different parents from the current draw.`);
		}
		const parents: [Species, Species] = [this.candidates[a].species, this.candidates[b].species];
		if (parents.some(parent => this.used.has(parent.id))) throw new ChimeraError(`A parent has already been used.`);
		const set = createChimera({ seed: this.seed, parents, mask, types }, ability, item, moves);
		this.team.push(set);
		for (const parent of parents) this.used.add(parent.id);
		if (this.team.length < 6) this.draw();
		this.revision++;
		return set;
	}

	/** The CPU follows the same draft constraints, maximizing the three/three base-stat total. */
	finishForCPU(): PokemonSet[] {
		while (this.team.length < 6) {
			let best = { a: 0, b: 1, mask: 7, score: -1 };
			for (let a = 0; a < 3; a++) {
				for (let b = a + 1; b < 3; b++) {
					for (let mask = 0; mask < 64; mask++) {
						if (CHIMERA_STATS.filter((_, i) => mask & (1 << i)).length !== 3) continue;
						const score = CHIMERA_STATS.reduce((sum, stat, i) => (
							sum + this.candidates[mask & (1 << i) ? a : b].species.baseStats[stat]
						), 0);
						if (score > best.score) best = { a, b, mask, score };
					}
				}
			}
			const a = this.candidates[best.a];
			const b = this.candidates[best.b];
			const moves = [...new Set([...a.moves, ...b.moves])];
			// Keep some of the parent's utility, but avoid a CPU with four non-damaging moves.
			moves.sort((x, y) => Number(Dex.moves.get(x).category === 'Status') - Number(Dex.moves.get(y).category === 'Status'));
			this.add(best.a, best.b, best.mask, [0, 0], a.species.abilities[0], a.item, moves.slice(0, 4));
		}
		return this.team;
	}
}
