'use strict';

const assert = require('assert').strict;
const { makeUser, destroyUser } = require('../../users-utils');
const { commands, handlers, renderChimera, sessions } = require('../../../dist/server/chat-plugins/chimera');

describe('Chimera builder commands and pages', () => {
	let user;
	let context;

	beforeEach(() => {
		user = makeUser('ChimeraTester');
		context = {
			parse: () => {},
			refreshPage: () => {},
			closePage: () => {},
		};
	});
	afterEach(() => {
		const roomid = sessions.get(user)?.battleRoom;
		if (roomid) Rooms.get(roomid)?.destroy();
		handlers.onDisconnect(user);
		destroyUser(user);
	});

	function command(action, args = '') {
		const session = sessions.get(user);
		const target = `${action}${session ? ` ${session.draft.revision}${args ? `,${args}` : ''}` : ''}`;
		return commands.chimera.call(context, target, null, user);
	}

	it('should require a named user and show an explicit entry point', () => {
		assert(renderChimera().includes('Start a draft'));
		assert(!renderChimera().includes('\n'));
		user.named = false;
		assert.throws(() => command('new'), /username/);
		assert(!sessions.has(user));
	});

	it('should reopen and focus the builder when returning from an existing battle tab', () => {
		const navigation = [];
		context.closePage = page => navigation.push(`close ${page}`);
		context.parse = target => navigation.push(target);
		commands.chimera.call(context, '', null, user);
		assert.deepEqual(navigation, ['close chimera', '/join view-chimera']);
	});

	it('should select parents, show the builder and persist a submitted fusion into the next round', () => {
		command('new');
		const session = sessions.get(user);
		command('parent', '0');
		command('parent', '1');
		const html = renderChimera(session);
		assert(!html.includes('\n'));
		assert(html.includes('data-submitsend="/chimera add'));
		for (const field of ['hp', 'atk', 'def', 'spa', 'spd', 'spe', 'typea', 'typeb', 'ability', 'item', 'move4']) {
			assert(html.includes(`name="${field}"`), field);
		}
		const parent = session.draft.candidates[0];
		command('add', `0,0,0,1,1,1,0,0,${parent.species.abilities[0]},${parent.item},${parent.moves.join(',')}`);
		assert.equal(session.draft.team.length, 1);
		assert.equal(session.draft.used.size, 2);
		assert.deepEqual(session.parents, []);
		assert(renderChimera(session).includes('Draft 2 / 6'));
	});

	it('should reject invalid selections and stale controls, and reset selection after rerolling', () => {
		command('new');
		command('parent', '0');
		command('parent', '1');
		assert.throws(() => command('parent', '2'), /Deselect/);
		assert.throws(() => command('parent', '99'), /current draw/);
		assert.throws(() => commands.chimera.call(context, 'reroll 0', null, user), /out of date/);
		command('reroll');
		assert.deepEqual(sessions.get(user).parents, []);
		assert.equal(sessions.get(user).draft.rerolls, 1);
		const revision = sessions.get(user).draft.revision;
		command('new');
		assert(sessions.get(user).draft.revision > revision);
		assert.throws(() => commands.chimera.call(context, `parent ${revision},0`, null, user), /out of date/);
	});

	it('should reject an invalid stat split without discarding the selected parents or consuming a round', () => {
		command('new');
		command('parent', '0');
		command('parent', '1');
		const session = sessions.get(user);
		const parent = session.draft.candidates[0];
		assert.throws(() => command('add',
			`0,0,0,0,0,0,0,0,${parent.species.abilities[0]},${parent.item},${parent.moves.join(',')}`), /assignment/);
		assert.equal(session.draft.team.length, 0);
		assert.deepEqual(session.parents, [0, 1]);
		assert(renderChimera(session).includes('Invalid Chimera stat or type assignment.'));
		command('parent', '1');
		assert(!session.error);
	});

	it('should hand off to a native CPU battle room, link back to it and reject draft edits', () => {
		command('new');
		assert.throws(() => command('battle'), /six/);
		const session = sessions.get(user);
		session.draft.finishForCPU();
		command('battle');
		const battleRoom = Rooms.get(session.battleRoom);
		assert(battleRoom.battle.cpu);
		assert(user.inRooms.has(battleRoom.roomid));
		assert(renderChimera(session).includes(`href="/${battleRoom.roomid}"`));
		assert(!renderChimera(session).includes('\n'));
		assert.throws(() => command('reroll'), /new draft/);
		assert.throws(() => command('battle'), /Finish or forfeit/);
		assert.throws(() => command('new'), /Finish or forfeit/);
	});

	it('should escape errors in the page and clean up draft state on disconnect', () => {
		command('new');
		const session = sessions.get(user);
		session.error = '<script>bad()</script>';
		const html = renderChimera(session);
		assert(!html.includes('<script>'));
		assert(html.includes('&lt;script&gt;'));
		handlers.onDisconnect(user);
		assert(!sessions.has(user));
	});
});
