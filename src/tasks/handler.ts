import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { decodeDocRef, encodeDocRef, toggleTaskLine } from './toggle.ts';

export const TOGGLE_PATH = '/toggle-task';

/**
 * A `vscode://` link reaches this handler from anywhere: a web page, an email, a terminal. Only
 * links Folio rendered into a preview during this session carry this key, so a link crafted
 * elsewhere cannot edit files even after the user has told VS Code to stop asking.
 */
const SESSION_KEY = randomBytes(18).toString('base64url');

/**
 * The preview webview cannot message this extension directly. A real click on a `vscode://`
 * link inside it, though, is routed by VS Code to the URI handler of the extension named in the
 * link's authority, which is how a checkbox click reaches `handleUri` below.
 */
export function toggleHref(extensionId: string, document: vscode.Uri, line: number, checked: boolean): string {
	const query = `d=${encodeDocRef(document.toString())}&line=${line}&checked=${checked ? 1 : 0}&k=${SESSION_KEY}`;
	return `${vscode.env.uriScheme}://${extensionId}${TOGGLE_PATH}?${query}`;
}

export class TaskToggleUriHandler implements vscode.UriHandler {
	async handleUri(uri: vscode.Uri): Promise<void> {
		if (uri.path !== TOGGLE_PATH) {
			return;
		}
		try {
			await toggleTask(uri);
		} catch (err) {
			void vscode.window.showErrorMessage(`Folio: could not toggle the task: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
}

async function toggleTask(uri: vscode.Uri): Promise<void> {
	const params = new URLSearchParams(uri.query);
	if (params.get('k') !== SESSION_KEY) {
		// Also what a checkbox in a preview drawn before an extension-host restart sends.
		void vscode.window.showWarningMessage('Folio ignored a task link it did not create in this session. If you clicked a checkbox, refresh the preview (or reopen it) and try again.');
		return;
	}
	const ref = params.get('d');
	const line = Number(params.get('line'));
	if (!ref || !Number.isInteger(line) || line < 0) {
		return;
	}

	const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(decodeDocRef(ref), true));
	if (document.languageId !== 'markdown' || line >= document.lineCount) {
		return;
	}

	const result = toggleTaskLine(document.lineAt(line).text, params.get('checked') === '1');
	if (!result.ok) {
		void vscode.window.showWarningMessage('Folio: the preview is out of date with the file, so the task was not changed. Try again once the preview refreshes.');
		return;
	}

	const wasDirty = document.isDirty;
	const edit = new vscode.WorkspaceEdit();
	edit.replace(document.uri, new vscode.Range(line, result.column, line, result.column + 1), result.replacement);
	if (!await vscode.workspace.applyEdit(edit)) {
		void vscode.window.showWarningMessage('Folio: VS Code refused the edit; the file may be read-only.');
		return;
	}

	const saveAfter = vscode.workspace.getConfiguration('folio', document.uri).get<boolean>('tasks.saveAfterToggle', true);
	if (saveAfter && !wasDirty) {
		await document.save();
	}
}
