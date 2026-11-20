/**
 * Runs inside VS Code's Markdown preview webview.
 *
 * Renders the `.folio-mermaid` placeholders emitted by the markdown-it plugin, the way Markdown
 * Preview Enhanced does: a plain SVG at its natural size, no viewport box around it. Also keeps the
 * table of contents panel in step with the document.
 */
import mermaid from 'mermaid';
import { updateToc } from './toc.ts';

type Theme = NonNullable<Parameters<typeof mermaid.initialize>[0]['theme']>;

/** Rendered SVG per theme + source, so a re-render after each keystroke does not flicker. */
const svgCache = new Map<string, string>();
let initializedTheme: string | undefined;
let renderSeq = 0;
/** mermaid.render is not re-entrant, so renders are queued one after another. */
let queue: Promise<void> = Promise.resolve();

function placeholders(): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>('div.folio-mermaid'))
		.filter((el) => el.querySelector(':scope > pre.folio-mermaid-source'));
}

function cacheKey(theme: string, source: string): string {
	return `${theme}\u0000${source}`;
}

function sourceOf(el: HTMLElement): string {
	return el.querySelector(':scope > pre.folio-mermaid-source')?.textContent?.trim() ?? '';
}

function showSvg(el: HTMLElement, svg: string): void {
	el.innerHTML = svg;
	el.classList.remove('folio-mermaid-error');
}

function showError(el: HTMLElement, source: string, err: unknown): void {
	const message = err instanceof Error ? err.message : String(err);
	el.classList.add('folio-mermaid-error');
	el.replaceChildren();
	const title = document.createElement('div');
	title.className = 'folio-mermaid-error-message';
	title.textContent = `Mermaid: ${message}`;
	const pre = document.createElement('pre');
	pre.textContent = source;
	el.append(title, pre);
}

async function renderOne(el: HTMLElement, source: string, theme: string): Promise<void> {
	if (initializedTheme !== theme) {
		mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme as Theme });
		initializedTheme = theme;
	}
	const id = `folio-mermaid-${++renderSeq}`;
	try {
		const { svg, bindFunctions } = await mermaid.render(id, source);
		svgCache.set(cacheKey(theme, source), svg);
		if (el.isConnected) {
			showSvg(el, svg);
			bindFunctions?.(el);
		}
	} catch (err) {
		// On failure mermaid can leave its scratch element in the body.
		document.getElementById(`d${id}`)?.remove();
		document.getElementById(id)?.remove();
		if (el.isConnected) {
			showError(el, source, err);
		}
	}
}

function renderAll(): void {
	const pending: Array<{ el: HTMLElement; source: string; theme: string }> = [];
	// Cache hits are applied synchronously, before the browser paints the freshly patched DOM.
	for (const el of placeholders()) {
		const source = sourceOf(el);
		const theme = el.dataset.theme || 'default';
		if (!source) {
			continue;
		}
		const cached = svgCache.get(cacheKey(theme, source));
		if (cached) {
			showSvg(el, cached);
		} else {
			pending.push({ el, source, theme });
		}
	}
	for (const job of pending) {
		queue = queue.then(() => renderOne(job.el, job.source, job.theme));
	}
}

function update(): void {
	updateToc();
	renderAll();
}

window.addEventListener('vscode.markdown.updateContent', update);
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', update);
} else {
	update();
}
