/**
 * markdown-it plugin: GitHub-style task lists whose checkboxes link back to the extension.
 *
 * VS Code tokenizes a document without telling plugins which document it is (`env.currentDocument`
 * is only set when rendering), so the parse step records the source line and the render step,
 * which does know the document, builds the link.
 */
import type { MarkdownIt, Token } from 'markdown-it';

export const TASK_TOKEN = 'folio_task_checkbox';

const MARKER = /^\[([ xX])\](?=[ \t]|$)/;

/**
 * The checkbox `markdown-it-task-lists` (bundled by Markdown All in One) leaves in place of the
 * marker. markdown-it runs the rule registered last first, so when that plugin is set up after
 * Folio it has already consumed the `[ ]` by the time Folio's rule sees the paragraph.
 */
const FOREIGN_CHECKBOX = /^<input class="task-list-item-checkbox"( checked="")?(?: disabled="" )?type="checkbox">$/;

export interface TaskMeta {
	checked: boolean;
	/** Zero-based source line of the paragraph that starts with the marker. */
	line: number | undefined;
}

export interface TaskListOptions {
	/** Link that toggles the task, or undefined to render a plain, disabled checkbox. */
	toggleHref(env: unknown, meta: TaskMeta): string | undefined;
}

export function taskListPlugin(md: MarkdownIt, options: TaskListOptions): void {
	md.core.ruler.after('inline', 'folio_task_lists', (state) => {
		const tokens = state.tokens;
		for (let i = 2; i < tokens.length; i++) {
			const inline = tokens[i];
			const paragraph = tokens[i - 1];
			const item = tokens[i - 2];
			if (inline.type !== 'inline' || paragraph.type !== 'paragraph_open' || item.type !== 'list_item_open') {
				continue;
			}
			const first = inline.children?.[0];
			let checked: boolean;
			if (first?.type === 'text') {
				const match = MARKER.exec(first.content);
				if (!match) {
					continue;
				}
				checked = match[1] !== ' ';
				first.content = first.content.slice(3);
			} else if (first?.type === 'html_inline') {
				const match = FOREIGN_CHECKBOX.exec(first.content);
				if (!match) {
					continue;
				}
				// The other plugin has already removed the marker from the text that follows.
				checked = match[1] !== undefined;
				inline.children!.shift();
			} else {
				continue;
			}

			const checkbox = new state.Token(TASK_TOKEN, '', 0);
			checkbox.meta = { checked, line: paragraph.map?.[0] } satisfies TaskMeta;
			inline.children!.unshift(checkbox);

			if (!hasClass(item, 'task-list-item')) {
				item.attrJoin('class', 'task-list-item');
			}
			const list = findParentList(tokens, i - 2);
			if (list && !hasClass(list, 'contains-task-list')) {
				list.attrJoin('class', 'contains-task-list');
			}
		}
	});

	md.renderer.rules[TASK_TOKEN] = (tokens, idx, _opts, env) => {
		const meta = tokens[idx].meta as unknown as TaskMeta;
		const href = options.toggleHref(env, meta);
		const checked = meta.checked ? ' checked' : '';
		if (!href) {
			return `<input type="checkbox" class="task-list-item-checkbox" disabled${checked}>`;
		}
		const action = meta.checked ? 'Uncheck' : 'Check';
		return `<a class="folio-task" href="${md.utils.escapeHtml(href)}" title="${action} this task" ` +
			`role="checkbox" aria-checked="${meta.checked}">` +
			`<input type="checkbox" class="task-list-item-checkbox" tabindex="-1" aria-hidden="true"${checked}></a>`;
	};
}

function hasClass(token: Token, name: string): boolean {
	return String(token.attrGet('class') ?? '').split(/\s+/).includes(name);
}

function findParentList(tokens: Token[], itemIndex: number): Token | undefined {
	const level = tokens[itemIndex].level - 1;
	for (let j = itemIndex - 1; j >= 0; j--) {
		if (tokens[j].level === level && (tokens[j].type === 'bullet_list_open' || tokens[j].type === 'ordered_list_open')) {
			return tokens[j];
		}
	}
	return undefined;
}
