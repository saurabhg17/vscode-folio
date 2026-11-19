/**
 * Pure task-line editing, kept free of the `vscode` module so it can be unit tested.
 */

/**
 * A task marker at the start of a line, after any blockquote markers, list markers and indentation:
 * `- [ ] a`, `  1. [x] b`, `> * [X] c`, `- - [ ] d`, or a bare `[ ] e` when the list marker sits on
 * the line above. Group 1 is everything before the `[`, group 2 the state character.
 */
const TASK_LINE = /^((?:[ \t]*(?:>|[-*+](?=[ \t])|\d{1,9}[.)](?=[ \t])))*[ \t]*)\[([ xX])\](?=[ \t]|$)/;

export type ToggleResult =
	| { ok: true; column: number; replacement: 'x' | ' ' }
	| { ok: false; reason: 'not-a-task' | 'stale' };

/**
 * Work out the one-character edit that flips the task on `lineText`.
 *
 * @param wasChecked the state the preview showed when it was clicked; if the source no longer
 *        matches it, the preview was out of date and nothing is changed.
 */
export function toggleTaskLine(lineText: string, wasChecked: boolean): ToggleResult {
	const match = TASK_LINE.exec(lineText);
	if (!match) {
		return { ok: false, reason: 'not-a-task' };
	}
	const isChecked = match[2] !== ' ';
	if (isChecked !== wasChecked) {
		return { ok: false, reason: 'stale' };
	}
	return { ok: true, column: match[1].length + 1, replacement: isChecked ? ' ' : 'x' };
}

/** Encode a document URI for a query string without any characters that a URI parser may decode. */
export function encodeDocRef(uri: string): string {
	return Buffer.from(uri, 'utf8').toString('base64url');
}

export function decodeDocRef(ref: string): string {
	return Buffer.from(ref, 'base64url').toString('utf8');
}
