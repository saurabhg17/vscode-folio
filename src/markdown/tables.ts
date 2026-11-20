/**
 * markdown-it plugin: drops the header row of a table whose header cells are all empty.
 *
 * GitHub-flavoured Markdown has no syntax for a table without a header, so such a table is written
 * with an empty one (`| | |` above the `|---|---|` line). Rendered as is, the empty row still
 * draws the rule that belongs under a header. Removing it at parse time leaves the body rows
 * between the table's top and bottom rules.
 */
import type { MarkdownIt, Token } from 'markdown-it';

export function headerlessTablesPlugin(md: MarkdownIt): void {
	md.core.ruler.after('inline', 'folio_headerless_tables', (state) => {
		const tokens = state.tokens;
		for (let i = 0; i < tokens.length; i++) {
			if (tokens[i].type !== 'thead_open') {
				continue;
			}
			const close = findClose(tokens, i, 'thead_close');
			// A table with no body rows keeps its header: without it the table would be empty.
			if (close !== undefined && tokens[close + 1]?.type === 'tbody_open' && isEmptyHeader(tokens, i, close)) {
				tokens.splice(i, close - i + 1);
			}
		}
	});
}

function findClose(tokens: Token[], open: number, type: string): number | undefined {
	for (let j = open + 1; j < tokens.length; j++) {
		if (tokens[j].type === type && tokens[j].level === tokens[open].level) {
			return j;
		}
	}
	return undefined;
}

function isEmptyHeader(tokens: Token[], open: number, close: number): boolean {
	for (let j = open + 1; j < close; j++) {
		if (tokens[j].type === 'inline' && tokens[j].content.trim() !== '') {
			return false;
		}
	}
	return true;
}
