import * as vscode from 'vscode';
import type { MarkdownIt } from 'markdown-it';
import { lineLengthPlugin } from './markdown/lineLength.ts';
import { mermaidPlugin } from './markdown/mermaid.ts';
import { headerlessTablesPlugin } from './markdown/tables.ts';
import { taskListPlugin } from './markdown/taskLists.ts';
import { tocPlugin } from './markdown/toc.ts';
import { TaskToggleUriHandler, toggleHref } from './tasks/handler.ts';

/** Extensions whose markdown-it plugins fight with Folio's over the same syntax. */
const CONFLICTING = [
	'bierner.markdown-checkbox',
	'bierner.markdown-mermaid',
	'saurabh.markdown-preview-typography',
];

/** VS Code's markdown-it env carries the document being rendered as a `vscode.Uri`. */
function documentOf(env: unknown): vscode.Uri | undefined {
	const doc = (env as { currentDocument?: unknown } | undefined)?.currentDocument;
	if (doc instanceof vscode.Uri) {
		return doc;
	}
	// Fall back to the URI's shape in case another extension's Uri class is not this one.
	if (doc && typeof doc === 'object' && 'scheme' in doc && 'path' in doc) {
		const { scheme, authority, path, query, fragment } = doc as vscode.Uri;
		return vscode.Uri.from({ scheme, authority, path, query, fragment });
	}
	return undefined;
}

function config(env: unknown): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration('folio', documentOf(env) ?? null);
}

export function activate(context: vscode.ExtensionContext) {
	const extensionId = context.extension.id;
	context.subscriptions.push(vscode.window.registerUriHandler(new TaskToggleUriHandler()));
	// The preview only redraws by itself for VS Code's own markdown.* settings.
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
		if (e.affectsConfiguration('folio')) {
			void vscode.commands.executeCommand('markdown.preview.refresh');
		}
	}));
	warnAboutConflicts(context);

	return {
		extendMarkdownIt(md: MarkdownIt): MarkdownIt {
			taskListPlugin(md, {
				toggleHref(env, meta) {
					const doc = documentOf(env);
					if (!doc || meta.line === undefined || !config(env).get<boolean>('tasks.clickable', true)) {
						return undefined;
					}
					return toggleHref(extensionId, doc, meta.line, meta.checked);
				},
			});
			mermaidPlugin(md, {
				enabled: (env) => config(env).get<boolean>('mermaid.enabled', true),
				theme: (env) => config(env).get<string>('mermaid.theme', 'default'),
			});
			headerlessTablesPlugin(md);
			lineLengthPlugin(md, {
				// Only previews of a document; other callers of the engine get plain HTML.
				lineLength: (env) => documentOf(env) ? config(env).get<number>('lineLength', 85) : undefined,
			});
			tocPlugin(md, {
				levels: (env) => documentOf(env) && config(env).get<boolean>('toc.enabled', true)
					? config(env).get<number>('toc.levels', 3)
					: undefined,
			});
			return md;
		},
	};
}

function warnAboutConflicts(context: vscode.ExtensionContext): void {
	const found = CONFLICTING.filter((id) => vscode.extensions.getExtension(id));
	const key = `folio.conflictWarningDismissed:${found.join(',')}`;
	if (found.length === 0 || context.globalState.get<boolean>(key)) {
		return;
	}
	const show = 'Show Extensions';
	const never = "Don't Show Again";
	void vscode.window.showWarningMessage(
		`Folio replaces ${found.join(', ')}. Disable ${found.length === 1 ? 'it' : 'them'} so checkboxes and diagrams are not rendered twice.`,
		show, never,
	).then((choice) => {
		if (choice === show) {
			void vscode.commands.executeCommand('workbench.extensions.search', `@installed ${found.join(' ')}`);
		} else if (choice === never) {
			void context.globalState.update(key, true);
		}
	});
}

export function deactivate() { }
