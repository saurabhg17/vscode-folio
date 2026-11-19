# Folio — Markdown Preview

Folio improves VS Code's built-in Markdown preview (open with `Ctrl+Shift+V`, or `Ctrl+K V` beside the editor) instead of replacing it, so the preview's scroll sync, link handling and keyboard shortcuts stay as they are.

## Features

- **Typography.** A readable text column, tuned heading spacing, ligature-aware code font and tabular figures in tables. It sits on top of [Markdown Preview GitHub Styling](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-preview-github-styles), which is installed with it and supplies the colours.
- **Clickable task lists.** `- [ ]` and `- [x]` items render as checkboxes. Clicking one checks or unchecks the task in the source file and saves it.
- **Mermaid diagrams.** ` ```mermaid ` blocks render as diagrams at their natural size on the white page, with Mermaid 12. A broken diagram shows Mermaid's error and its source in place of the diagram.

## Clicking a checkbox the first time

The preview cannot talk to extensions directly, so each checkbox is a `vscode://saurabh.folio/…` link that VS Code routes to Folio. The first click shows *"Allow 'Folio — Markdown Preview' extension to open this URI?"*. Tick **Do not ask me again for this extension** and choose **Open**. To skip the prompt entirely, add this to your settings:

```json
"extensions.confirmedUriHandlerExtensionIds": ["saurabh.folio"]
```

If the file changed since the preview last refreshed, the click is ignored with a warning rather than flipping the wrong task.

Each link carries a random key that Folio generates when it starts, so a `vscode://saurabh.folio/…` link from a web page or email cannot edit your files, even after you have told VS Code to stop asking. A preview drawn before VS Code's extension host restarted has stale keys; refresh it if a click is refused.

## Settings

| Setting | Default | Effect |
| --- | --- | --- |
| `folio.tasks.clickable` | `true` | Make checkboxes clickable. When off they render read-only. |
| `folio.tasks.saveAfterToggle` | `true` | Save after a toggle. A file that already had unsaved changes is never saved automatically. |
| `folio.mermaid.enabled` | `true` | Render Mermaid blocks. |
| `folio.mermaid.theme` | `default` | Mermaid theme. A `%%{init: {'theme': 'forest'}}%%` line in a diagram overrides it. |

## Extensions Folio replaces

Disable these if installed; Folio warns once on start-up when it finds them:

- `bierner.markdown-checkbox` (read-only checkboxes)
- `bierner.markdown-mermaid` (Mermaid with pan/zoom boxes)
- `saurabh.markdown-preview-typography` (Folio's own predecessor)

## Install

```sh
code --install-extension folio-2.0.0.vsix
```

On a Remote-SSH or WSL window, install it from the Extensions view (**…** → **Install from VSIX…**) so it lands on the remote side, where the Markdown preview runs.

## Build

```sh
npm install
npm test            # unit tests (node:test)
npm run build       # dist/extension.js and dist/preview.js
npm run package     # typecheck, test, production build, then folio-<version>.vsix
```
