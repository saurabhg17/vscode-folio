import * as vscode from 'vscode';
import { decodeDocRef, encodeDocRef, toggleTaskLine } from './toggle.ts';

export const TOGGLE_PATH = '/toggle-task';

/**
 * The preview webview cannot message this extension directly. A real click on a `vscode://`
 * link inside it, though, is routed by VS Code to the URI handler of the extension named in the
 * link's authority, which is how a checkbox click reaches `handleUri` below.
 */
export function toggleHref(extensionId: string, document: vscode.Uri, line: number, checked: boolean): string {
	const query = `d=${encodeDocRef(document.toString())}&line=${line}&checked=${checked ? 1 : 0}`;
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
