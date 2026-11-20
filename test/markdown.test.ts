import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import markdownit, { type MarkdownIt } from 'markdown-it';
import { taskListPlugin, type TaskMeta } from '../src/markdown/taskLists.ts';
import { mermaidPlugin } from '../src/markdown/mermaid.ts';
import { lineLengthPlugin, measureFor } from '../src/markdown/lineLength.ts';
import { headerlessTablesPlugin } from '../src/markdown/tables.ts';
import { clampLevels, tocPlugin } from '../src/markdown/toc.ts';
import { outline } from '../src/preview/toc.ts';
import { toggleTaskLine } from '../src/tasks/toggle.ts';

/** Untyped CommonJS; the task-list plugin Markdown All in One bundles. */
const githubTaskLists = createRequire(import.meta.url)('markdown-it-task-lists') as
	(md: MarkdownIt, options: { enabled: boolean }) => void;

function engine(clickable = true): MarkdownIt {
	const md = markdownit();
	taskListPlugin(md, {
		toggleHref: (_env, meta: TaskMeta) =>
			clickable ? `vscode://saurabh.folio/toggle-task?line=${meta.line}&checked=${meta.checked ? 1 : 0}` : undefined,
	});
	mermaidPlugin(md, { enabled: () => true, theme: () => 'neutral' });
	return md;
}

test('renders clickable checkboxes that carry the source line', () => {
	const src = '# Todo\n\n- [ ] one\n- [x] two\n  - [ ] nested\n';
	const html = engine().render(src);
	assert.match(html, /<ul class="contains-task-list">/);
	assert.match(html, /href="vscode:\/\/saurabh\.folio\/toggle-task\?line=2&amp;checked=0"/);
	assert.match(html, /href="vscode:\/\/saurabh\.folio\/toggle-task\?line=3&amp;checked=1"/);
	assert.match(html, /href="vscode:\/\/saurabh\.folio\/toggle-task\?line=4&amp;checked=0"/);
	assert.match(html, /<li class="task-list-item"><a class="folio-task"[^>]*><input type="checkbox" class="task-list-item-checkbox" tabindex="-1" aria-hidden="true"><\/a> one<\/li>/);
});

test('every line the plugin links to is one the toggler accepts', () => {
	const lines = [
		'---', 'title: front matter counts as lines', '---', '',
		'- [ ] a', '- [x] b', '', '1. [ ] c', '   - [X] d', '', '> - [ ] e', '', '-', '  [ ] f',
	];
	const md = engine();
	const metas: TaskMeta[] = [];
	md.renderer.rules.folio_task_checkbox = (tokens, idx) => { metas.push(tokens[idx].meta as unknown as TaskMeta); return ''; };
	md.render(lines.join('\n'));
	assert.equal(metas.length, 6);
	for (const meta of metas) {
		assert.ok(meta.line !== undefined);
		const r = toggleTaskLine(lines[meta.line], meta.checked);
		assert.ok(r.ok, `line ${meta.line}: ${lines[meta.line]}`);
	}
});

test('leaves non-task brackets alone', () => {
	const html = engine().render('- [link](x)\n- plain [ ] text\n- [y] no\n\n[ ] not in a list\n');
	assert.doesNotMatch(html, /checkbox/);
});

test('renders disabled checkboxes when not clickable', () => {
	const html = engine(false).render('- [x] done\n');
	assert.match(html, /<input type="checkbox" class="task-list-item-checkbox" disabled checked>/);
	assert.doesNotMatch(html, /folio-task/);
});

test('turns mermaid fences into escaped placeholders and leaves other fences alone', () => {
	const md = engine();
	const html = md.render('```mermaid\ngraph TD; A-->B<script>\n```\n\n```js\nlet a = 1;\n```\n');
	assert.match(html, /<div class="folio-mermaid" data-theme="neutral"><pre class="folio-mermaid-source">graph TD; A--&gt;B&lt;script&gt;\n<\/pre><\/div>/);
	assert.match(html, /<pre><code class="language-js">/);
});

test('repeated renders of cached tokens do not accumulate classes', () => {
	const md = engine();
	const tokens = md.parse('```mermaid\ngraph TD; A-->B\n```\n', {});
	tokens[0].attrSet('class', 'code-line');
	const first = md.renderer.render(tokens, md.options, {});
	const second = md.renderer.render(tokens, md.options, {});
	assert.equal(first, second);
	assert.match(first, /class="code-line folio-mermaid"/);
});

for (const enabled of [true, false]) {
	test(`takes over checkboxes from markdown-it-task-lists registered after it (enabled: ${enabled})`, () => {
		// VS Code applies Folio's plugin before Markdown All in One's, so that rule runs first.
		const md = engine();
		githubTaskLists(md, { enabled });
		const html = md.render('- [ ] one\n- [x] two\n- [X] three\n- plain\n');
		assert.doesNotMatch(html, /<input class="task-list-item-checkbox"/);
		assert.match(html, /href="vscode:\/\/saurabh\.folio\/toggle-task\?line=0&amp;checked=0"[^>]*><input[^>]*><\/a> one<\/li>/);
		assert.match(html, /href="vscode:\/\/saurabh\.folio\/toggle-task\?line=1&amp;checked=1"[^>]*><input[^>]*checked><\/a> two<\/li>/);
		assert.match(html, /href="vscode:\/\/saurabh\.folio\/toggle-task\?line=2&amp;checked=1"[^>]*><input[^>]*checked><\/a> three<\/li>/);
		assert.equal(html.match(/task-list-item[" ]/g)?.length, 3);
		assert.match(html, /<li>plain<\/li>/);
	});
}

test('converts a line length in characters to a column width', () => {
	assert.equal(measureFor(100), '50em');
	assert.equal(measureFor(85), '42.5em');
	assert.equal(measureFor(5), '10em');
	assert.equal(measureFor(0), 'none');
	assert.equal(measureFor(Number.NaN), 'none');
});

test('prefixes the render with the column width, or leaves it alone', () => {
	const md = engine();
	let chars: number | undefined = 100;
	lineLengthPlugin(md, { lineLength: () => chars });
	assert.equal(md.render('text\n'), '<style>body { --md-measure: 50em; }</style>\n<p>text</p>\n');
	chars = 0;
	assert.match(md.render('text\n'), /^<style>body \{ --md-measure: none; \}<\/style>\n/);
	chars = undefined;
	assert.equal(md.render('text\n'), '<p>text</p>\n');
});

test('drops the header row of a table whose header cells are all empty', () => {
	const md = markdownit();
	headerlessTablesPlugin(md);
	for (const src of ['|  |  |\n|---|---|\n| a | b |\n', '|||\n|:-|-:|\n|a|b|\n']) {
		const html = md.render(src);
		assert.doesNotMatch(html, /<thead>|<th[ >]/, src);
		assert.match(html, /^<table>\n<tbody>\n<tr>\n<td[^>]*>a<\/td>\n<td[^>]*>b<\/td>/, src);
	}
});

test('keeps a header row with any text in it, and the header of a table with no body', () => {
	const md = markdownit();
	headerlessTablesPlugin(md);
	assert.match(md.render('| | x |\n|-|-|\n|a|b|\n'), /<thead>\n<tr>\n<th><\/th>\n<th>x<\/th>/);
	assert.match(md.render('| |\n|-|\n'), /<thead>/);
	const two = md.render('| |\n|-|\n|a|\n\n| h |\n|-|\n|b|\n');
	assert.equal(two.match(/<thead>/g)?.length, 1);
	assert.match(two, /<th>h<\/th>/);
});

test('passes the contents depth to the preview, or nothing when the panel is off', () => {
	const md = markdownit();
	let levels: number | undefined = 3;
	tocPlugin(md, { levels: () => levels });
	assert.equal(md.render('# A\n'), '<div class="folio-toc-config" data-levels="3" hidden></div>\n<h1>A</h1>\n');
	levels = 9;
	assert.match(md.render('# A\n'), /data-levels="6"/);
	levels = undefined;
	assert.equal(md.render('# A\n'), '<h1>A</h1>\n');
});

test('clamps the contents depth to a heading level', () => {
	assert.equal(clampLevels(0), 1);
	assert.equal(clampLevels(2.7), 2);
	assert.equal(clampLevels(7), 6);
	assert.equal(clampLevels(Number.NaN), undefined);
});

test('outlines headings down to the configured level, indented from the shallowest listed', () => {
	const headings = [
		{ level: 2, text: 'Intro', id: 'intro' },
		{ level: 3, text: 'Detail', id: 'detail' },
		{ level: 4, text: 'Too deep', id: 'too-deep' },
		{ level: 3, text: '  ', id: '' },
		{ level: 2, text: ' Usage ', id: 'usage' },
	];
	assert.deepEqual(outline(headings, 3).map((e) => [e.index, e.depth, e.text]), [
		[0, 0, 'Intro'],
		[1, 1, 'Detail'],
		[4, 0, 'Usage'],
	]);
	assert.deepEqual(outline(headings, 1), []);
	assert.deepEqual(outline([{ level: 1, text: 'Title', id: 't' }, ...headings], 2).map((e) => e.depth), [0, 1, 1]);
});
