/**
 * markdown-it plugin: turns ```mermaid fences into placeholders that the preview script renders.
 *
 * The placeholder keeps the diagram source as visible text, so a preview whose script failed
 * still shows something readable.
 */
import type { MarkdownIt } from 'markdown-it';

export interface MermaidOptions {
	enabled(env: unknown): boolean;
	theme(env: unknown): string;
}

export function mermaidPlugin(md: MarkdownIt, options: MermaidOptions): void {
	const fallback = md.renderer.rules.fence!;
	md.renderer.rules.fence = (tokens, idx, opts, env, self) => {
		const token = tokens[idx];
		const lang = token.info.trim().split(/\s+/, 1)[0].toLowerCase();
		if (lang !== 'mermaid' || !options.enabled(env)) {
			return fallback(tokens, idx, opts, env, self);
		}
		// Keep VS Code's line attributes (class="code-line" data-line=…) so scroll sync still works.
		// Tokens are cached across renders, so build the attributes on a copy rather than the token.
		const attrs = (token.attrs ?? []).filter(([name]) => name !== 'class');
		const classes = [token.attrGet('class'), 'folio-mermaid'].filter(Boolean).join(' ');
		attrs.push(['class', classes], ['data-theme', options.theme(env)]);
		const rendered = attrs.map(([name, value]) => ` ${name}="${md.utils.escapeHtml(String(value))}"`).join('');
		return `<div${rendered}><pre class="folio-mermaid-source">${md.utils.escapeHtml(token.content)}</pre></div>\n`;
	};
}
