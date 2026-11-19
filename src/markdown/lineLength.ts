/**
 * markdown-it plugin: sets the width of the preview's text column from a setting.
 *
 * folio.css takes the width from the `--md-measure` custom property. The rendered HTML is the
 * only way into the preview page, and the preview's content security policy allows inline
 * styles, so the render starts with a one-line `<style>` that overrides the property.
 */
import type { MarkdownIt } from 'markdown-it';

/** Characters per em of Source Serif 4 running text; measured: a 36em column held 72. */
const CHARS_PER_EM = 2;
/** Below this a column holds a word or two per line, which no setting means to ask for. */
const MIN_CHARS = 20;

export interface LineLengthOptions {
	/** Approximate characters per line, 0 to fill the pane, or undefined to keep the stylesheet's own width. */
	lineLength(env: unknown): number | undefined;
}

/** The CSS value of `--md-measure` for a line of about `chars` characters. */
export function measureFor(chars: number): string {
	if (!Number.isFinite(chars) || chars <= 0) {
		return 'none';
	}
	return `${Number((Math.max(chars, MIN_CHARS) / CHARS_PER_EM).toFixed(2))}em`;
}

export function lineLengthPlugin(md: MarkdownIt, options: LineLengthOptions): void {
	const render = md.renderer.render;
	md.renderer.render = (tokens, opts, env) => {
		const html = render.call(md.renderer, tokens, opts, env);
		const chars = options.lineLength(env);
		return chars === undefined ? html : `<style>body { --md-measure: ${measureFor(chars)}; }</style>\n${html}`;
	};
}
