'use strict';

const assert = require('assert').strict;
const { setTimeout: delay } = require('timers/promises');
const { makeUser, destroyUser } = require('../users-utils');
const { ChimeraDraft } = require('../../dist/sim/chimera');
const { PRNG } = require('../../dist/sim/prng');

describe('Native Chimera CPU battle rooms', () => {
	let user, visitor, room;
	afterEach(() => {
		room?.destroy();
		if (visitor) destroyUser(visitor);
		if (user) destroyUser(user);
		room = user = visitor = null;
	});

	async function waitFor(predicate) {
		for (let i = 0; i < 2000; i++) {
			if (predicate()) return;
			await delay(1);
		}
		assert.fail('Timed out waiting for the native simulator request');
	}

	async function start() {
		user = makeUser('NativeChimeraTester');
		room = Rooms.createBattle({
			format: 'gen9chimera', players: [{
				user, team: Teams.pack(new ChimeraDraft(new PRNG('1,2,3,4')).finishForCPU()),
			}],
			cpu: {
				name: 'Chimera CPU', team: Teams.pack(new ChimeraDraft(new PRNG('5,6,7,8')).finishForCPU()),
			},
			seed: '9,10,11,12',
			allowRenames: false,
		});
		await waitFor(() => room.battle.p1.request.request && room.battle.p2.request.isWait === true);
		return room.battle;
	}

	it('should create a normal battle room, autojoin the human and let the CPU answer team preview', async () => {
		const battle = await start();
		assert.equal(room.type, 'battle');
		assert(user.inRooms.has(room.roomid));
		assert.equal(battle.p2.name, 'Chimera CPU');
		assert.equal(battle.p2.getUser(), null);
		assert.equal(battle.rated, 0);
		assert(battle.started && battle.p2.active);
		assert(JSON.parse(battle.p1.request.request).teamPreview);
		battle.choose(user, `default|${battle.p1.request.rqid}`);
		await waitFor(() => battle.turn === 1 && battle.p1.request.isWait === false);
		const request = JSON.parse(battle.p1.request.request);
		assert.equal(request.active[0].moves.length, 4);
		assert(!request.active[0].canTerastallize);
		assert(battle.p2.request.isWait);
	});

	it('should reserve the CPU slot so a visitor cannot take it over', async () => {
		const battle = await start();
		visitor = makeUser('ChimeraVisitor');
		room.auth.set(visitor.id, Users.PLAYER_SYMBOL);
		assert.equal(battle.joinGame(visitor, 'p2'), false);
		assert.equal(battle.joinGame(visitor), false);
		assert.equal(battle.p2.name, 'Chimera CPU');
	});

	it('should complete a native battle including forced switches without stalling', async function () {
		this.timeout(20000);
		const battle = await start();
		let actions = 0;
		let switches = 0;
		while (!battle.ended && actions++ < 1200) {
			await waitFor(() => battle.ended || battle.p1.request.isWait === false);
			if (battle.ended) break;
			const request = JSON.parse(battle.p1.request.request);
			if (request.forceSwitch) switches++;
			const rqid = battle.p1.request.rqid;
			battle.choose(user, `default|${rqid}`);
			await waitFor(() => battle.ended || battle.p1.request.rqid !== rqid);
		}
		assert(battle.ended);
		assert(switches > 0);
		assert(!user.games.has(room.roomid));
	});

	it('should use standard forfeits and clean up the CPU stream with the room', async () => {
		const battle = await start();
		assert(battle.forfeit(user));
		await waitFor(() => battle.ended);
		assert.equal(battle.endType, 'forfeit');
		assert(!user.games.has(room.roomid));
		assert(battle.cpu);
		room.destroy();
		room = null;
		assert.equal(battle.players.length, 0);
	});
});
