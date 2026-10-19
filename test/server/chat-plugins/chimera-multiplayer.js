'use strict';

const assert = require('assert').strict;
const { setTimeout: delay } = require('timers/promises');
const { makeUser, destroyUser } = require('../../users-utils');
const { ChimeraDraft } = require('../../../dist/sim/chimera');
const { commands, handlers, renderChimera, sessions } = require('../../../dist/server/chat-plugins/chimera');

describe('Chimera friend challenges', () => {
	let alice, bob, visitor;
	const context = { parse() {}, refreshPage() {}, closePage() {} };

	function command(user, action, args = '') {
		const revision = sessions.get(user).draft.revision;
		return commands.chimera.call(context, `${action} ${revision}${args ? `,${args}` : ''}`, null, user);
	}

	function ready(user) {
		const draft = new ChimeraDraft();
		draft.finishForCPU();
		sessions.set(user, { draft, parents: [] });
	}

	beforeEach(() => {
		alice = makeUser('ChimeraAlice');
		bob = makeUser('ChimeraBob');
		visitor = makeUser('ChimeraVisitor');
		for (const user of [alice, bob, visitor]) ready(user);
	});

	afterEach(() => {
		for (const user of [alice, bob, visitor]) {
			const roomid = sessions.get(user)?.battleRoom;
			if (roomid) Rooms.get(roomid)?.destroy();
			handlers.onDisconnect(user);
			destroyUser(user);
		}
	});

	it('should render the friend form, lock both teams and show accept/decline only to the recipient', () => {
		assert(renderChimera(sessions.get(alice), alice).includes('Challenge a friend'));
		command(alice, 'challenge', bob.name);
		const a = sessions.get(alice);
		const b = sessions.get(bob);
		assert.equal(a.challenge, b.challenge);
		assert(renderChimera(a, alice).includes('Waiting for ChimeraBob'));
		assert(!renderChimera(a, alice).includes('Accept friend challenge'));
		assert(renderChimera(b, bob).includes('Accept friend challenge'));
		for (const user of [alice, bob]) {
			for (const action of ['new', 'battle', 'reroll', 'parent']) {
				assert.throws(() => command(user, action), /pending challenge/);
			}
		}
		assert.throws(() => command(alice, 'accept'), /incoming challenge/);
		assert.throws(() => command(visitor, 'accept'), /incoming challenge/);
	});

	it('should start one native human-vs-human room with both exact drafted teams', async () => {
		command(alice, 'challenge', bob.name);
		const oldRevision = sessions.get(bob).draft.revision;
		command(bob, 'accept');
		const a = sessions.get(alice);
		const b = sessions.get(bob);
		assert.equal(a.battleRoom, b.battleRoom);
		const room = Rooms.get(a.battleRoom);
		assert(room.battle);
		assert.equal(room.battle.cpu, null);
		assert.equal(room.battle.p1.getUser(), alice);
		assert.equal(room.battle.p2.getUser(), bob);
		assert(alice.inRooms.has(room.roomid) && bob.inRooms.has(room.roomid));
		assert(!a.challenge && !b.challenge);
		const team = await room.battle.getTeam(alice);
		assert.deepEqual(team.map(set => set.name), a.draft.team.map(set => set.name));
		assert.throws(() => commands.chimera.call(context, `accept ${oldRevision}`, null, bob), /out of date/);
		for (let i = 0; i < 100 && !room.battle.p2.request.request; i++) await delay(1);
		assert(JSON.parse(room.battle.p1.request.request).teamPreview);
		assert(JSON.parse(room.battle.p2.request.request).teamPreview);
		room.battle.choose(alice, 'default');
		room.battle.choose(bob, 'default');
		for (let i = 0; i < 100 && room.battle.turn < 1; i++) await delay(1);
		assert.equal(room.battle.turn, 1);
		room.battle.choose(alice, 'default');
		room.battle.choose(bob, 'default');
		for (let i = 0; i < 100 && room.battle.turn < 2; i++) await delay(1);
		assert.equal(room.battle.turn, 2);
	});

	it('should allow either side to cancel and invalidate stale accept controls', () => {
		for (const cancelling of [alice, bob]) {
			alice.lastChallenge = 0;
			command(alice, 'challenge', bob.name);
			const revision = sessions.get(bob).draft.revision;
			command(cancelling, 'cancel');
			assert(!sessions.get(alice).challenge && !sessions.get(bob).challenge);
			assert.throws(() => commands.chimera.call(context, `accept ${revision}`, null, bob), /out of date/);
		}
	});

	it('should reject offline/self targets and unfinished teams without creating a challenge', () => {
		assert.throws(() => command(alice, 'challenge', alice.name), /yourself/);
		assert.throws(() => command(alice, 'challenge', 'NotOnline12345'), /online/);
		sessions.get(bob).draft.team.pop();
		assert.throws(() => command(alice, 'challenge', bob.name), /six/);
		assert(!sessions.get(alice).challenge);
	});

	it('should respect blocked challenges and existing pending challenges', () => {
		bob.settings.blockChallenges = true;
		assert.throws(() => command(alice, 'challenge', bob.name), /not accepting/);
		bob.settings.blockChallenges = false;
		command(alice, 'challenge', bob.name);
		assert.throws(() => command(visitor, 'challenge', bob.name), /pending Chimera challenge/);
	});

	it('should revalidate both teams at acceptance instead of trusting the challenge-time check', () => {
		command(alice, 'challenge', bob.name);
		sessions.get(alice).draft.team[0].ability = 'Wonder Guard';
		assert.throws(() => command(bob, 'accept'), /ability/);
		assert(!sessions.get(bob).battleRoom);
		command(bob, 'cancel');
	});

	it('should expire challenges and cancel pending challenges on disconnect', () => {
		command(alice, 'challenge', bob.name);
		sessions.get(alice).challenge.expires = Date.now() - 1;
		assert.throws(() => command(bob, 'accept'), /expired/);
		assert(!sessions.get(alice).challenge && !sessions.get(bob).challenge);
		alice.lastChallenge = 0;
		command(alice, 'challenge', bob.name);
		handlers.onDisconnect(alice);
		assert(!sessions.has(alice));
		assert(!sessions.get(bob).challenge);
		assert(renderChimera(sessions.get(bob), bob).includes('disconnected'));
	});

	it('should throttle repeated challenge notifications', () => {
		command(alice, 'challenge', bob.name);
		command(alice, 'cancel');
		assert.throws(() => command(alice, 'challenge', bob.name), /ten seconds/);
	});
});
