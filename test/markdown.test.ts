import { test } from 'node:test';
import assert from 'node:assert/strict';
import markdownit, { type MarkdownIt } from 'markdown-it';
import { taskListPlugin, type TaskMeta } from '../src/markdown/taskLists.ts';
import { mermaidPlugin } from '../src/markdown/mermaid.ts';
import { toggleTaskLine } from '../src/tasks/toggle.ts';

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
