import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeDocRef, encodeDocRef, toggleTaskLine } from '../src/tasks/toggle.ts';

function apply(line: string, wasChecked: boolean): string {
	const r = toggleTaskLine(line, wasChecked);
	assert.ok(r.ok, `expected a toggle for ${JSON.stringify(line)}`);
	return line.slice(0, r.column) + r.replacement + line.slice(r.column + 1);
}

test('checks and unchecks bullet tasks', () => {
	assert.equal(apply('- [ ] write tests', false), '- [x] write tests');
	assert.equal(apply('- [x] write tests', true), '- [ ] write tests');
	assert.equal(apply('- [X] write tests', true), '- [ ] write tests');
	assert.equal(apply('* [ ] star', false), '* [x] star');
	assert.equal(apply('+ [ ] plus', false), '+ [x] plus');
});

test('handles ordered, nested, quoted and continuation lines', () => {
	assert.equal(apply('12. [ ] ordered', false), '12. [x] ordered');
	assert.equal(apply('3) [ ] paren', false), '3) [x] paren');
	assert.equal(apply('    - [ ] nested', false), '    - [x] nested');
	assert.equal(apply('\t- [x] tab', true), '\t- [ ] tab');
	assert.equal(apply('> - [ ] quoted', false), '> - [x] quoted');
	assert.equal(apply('> > 1. [ ] deep', false), '> > 1. [x] deep');
	assert.equal(apply('- - [ ] list in list', false), '- - [x] list in list');
	assert.equal(apply('  [ ] marker on line above', false), '  [x] marker on line above');
	assert.equal(apply('- [ ]', false), '- [x]');
});

test('only touches the marker, not later brackets', () => {
	assert.equal(apply('- [ ] see [x] and [ ]', false), '- [x] see [x] and [ ]');
});

test('rejects lines that are not tasks', () => {
	for (const line of ['plain [ ] text', '- [y] nope', '- [ ]no-space', '-[ ] no space after marker', '', '# [ ] heading']) {
		assert.deepEqual(toggleTaskLine(line, false), { ok: false, reason: 'not-a-task' }, line);
	}
});

test('refuses when the preview state is stale', () => {
	assert.deepEqual(toggleTaskLine('- [x] done', false), { ok: false, reason: 'stale' });
	assert.deepEqual(toggleTaskLine('- [ ] open', true), { ok: false, reason: 'stale' });
});

test('document refs round-trip URIs with reserved characters', () => {
	for (const uri of ['file:///home/me/a%20b%2Bc.md', 'vscode-remote://ssh-remote%2Bhost/x/y&z=1.md', 'untitled:Untitled-1']) {
		const ref = encodeDocRef(uri);
		assert.match(ref, /^[A-Za-z0-9_-]+$/);
		assert.equal(decodeDocRef(ref), uri);
	}
});
