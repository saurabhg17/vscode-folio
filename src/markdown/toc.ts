/**
 * markdown-it plugin: tells the preview script how deep the table of contents goes.
 *
 * The panel itself is built in the preview from the rendered headings, which carry the ids VS Code
 * gives them. The rendered HTML is the only way into the preview page, so the setting travels as a
 * hidden element at the start of the render; no element means no panel.
 */
import type { MarkdownIt } from 'markdown-it';

export const TOC_CONFIG_CLASS = 'folio-toc-config';

export interface TocOptions {
	/** Deepest heading level to list, or undefined for no panel. */
	levels(env: unknown): number | undefined;
}

/** The setting as a heading level from 1 to 6, or undefined when it is not a number. */
export function clampLevels(levels: number): number | undefined {
	if (!Number.isFinite(levels)) {
		return undefined;
	}
	return Math.min(6, Math.max(1, Math.trunc(levels)));
}

export function tocPlugin(md: MarkdownIt, options: TocOptions): void {
	const render = md.renderer.render;
	md.renderer.render = (tokens, opts, env) => {
		const html = render.call(md.renderer, tokens, opts, env);
		const requested = options.levels(env);
		const levels = requested === undefined ? undefined : clampLevels(requested);
		return levels === undefined ? html : `<div class="${TOC_CONFIG_CLASS}" data-levels="${levels}" hidden></div>\n${html}`;
	};
}
