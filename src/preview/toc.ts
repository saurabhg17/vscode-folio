/**
 * The table of contents panel on the left of the preview.
 *
 * VS Code replaces only the `.markdown-body` element when the document changes, so the panel lives
 * directly in `<body>`: it survives each update, keeps its own scroll position and stays
 * collapsed or open as the reader left it. Every update rebuilds the list from the headings.
 * Its right edge can be dragged to resize it.
 */

export interface Heading {
	/** 1 for `#`, 2 for `##`, ... */
	level: number;
	text: string;
	id: string;
}

export interface Entry extends Heading {
	/** Position among all headings in the document, which is how a click finds its target. */
	index: number;
	/** Indentation step, 0 for the shallowest heading level that is listed. */
	depth: number;
}

/** The headings to list, down to `levels`, indented relative to the shallowest one listed. */
export function outline(headings: Heading[], levels: number): Entry[] {
	const listed = headings
		.map((heading, index) => ({ ...heading, text: heading.text.trim(), index }))
		.filter((heading) => heading.level <= levels && heading.text !== '');
	const top = Math.min(...listed.map((heading) => heading.level));
	return listed.map((heading) => ({ ...heading, depth: heading.level - top }));
}

const CONFIG_SELECTOR = '.markdown-body .folio-toc-config';
const HEADING_SELECTOR = '.markdown-body :is(h1, h2, h3, h4, h5, h6)';
const OPEN_CLASS = 'folio-toc-open';
/** Below this pane width the panel would squeeze the text, so it starts collapsed and overlays. */
const NARROW_PX = 640;
const RESIZING_CLASS = 'folio-toc-resizing';
/** The panel's width lives in this custom property; folio.css holds its default. */
const WIDTH_PROPERTY = '--md-toc-width';
const MIN_WIDTH_PX = 140;
/** As a fraction of the pane, so the text always keeps most of it. */
const MAX_WIDTH_FRACTION = 0.6;
const KEY_STEP_PX = 16;

let panel: HTMLElement | undefined;
let list: HTMLOListElement | undefined;
let toggle: HTMLButtonElement | undefined;
/** The reader's choice, kept when a document without headings removes the panel for a while. */
let open: boolean | undefined;
/** What the list shows, so an update that changes no heading leaves the panel untouched. */
let shown = '';

function documentHeadings(): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>(HEADING_SELECTOR));
}

function setOpen(value: boolean): void {
	open = value;
	document.body.classList.toggle(OPEN_CLASS, open);
	toggle?.setAttribute('aria-expanded', String(open));
	toggle?.setAttribute('title', open ? 'Hide contents' : 'Show contents');
}

function createPanel(): HTMLElement {
	const aside = document.createElement('aside');
	aside.className = 'folio-toc';

	toggle = document.createElement('button');
	toggle.type = 'button';
	toggle.className = 'folio-toc-toggle';
	toggle.setAttribute('aria-controls', 'folio-toc-nav');
	toggle.setAttribute('aria-label', 'Contents');
	toggle.append(listIcon());
	toggle.addEventListener('click', () => setOpen(!open));

	const nav = document.createElement('nav');
	nav.id = 'folio-toc-nav';
	nav.setAttribute('aria-label', 'Contents');
	list = document.createElement('ol');
	list.addEventListener('click', onEntryClick);
	nav.append(list);

	aside.append(toggle, nav, createResizer(aside));
	document.body.append(aside);
	setOpen(open ?? window.innerWidth >= NARROW_PX);
	return aside;
}

/** Three short rules, drawn rather than taken from a font so every platform shows the same. */
function listIcon(): SVGSVGElement {
	const ns = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS(ns, 'svg');
	svg.setAttribute('viewBox', '0 0 16 16');
	svg.setAttribute('aria-hidden', 'true');
	for (const y of [4, 8, 12]) {
		const line = document.createElementNS(ns, 'line');
		line.setAttribute('x1', '2');
		line.setAttribute('x2', '14');
		line.setAttribute('y1', String(y));
		line.setAttribute('y2', String(y));
		svg.append(line);
	}
	return svg;
}

function setWidth(px: number): void {
	const max = Math.max(MIN_WIDTH_PX, window.innerWidth * MAX_WIDTH_FRACTION);
	const width = Math.round(Math.min(max, Math.max(MIN_WIDTH_PX, px)));
	// On <html>, so the width outlives the panel when a document without headings removes it.
	document.documentElement.style.setProperty(WIDTH_PROPERTY, `${width}px`);
}

/** A handle on the panel's right edge: drag it, or focus it and use the arrow keys. Double-click resets. */
function createResizer(aside: HTMLElement): HTMLElement {
	const handle = document.createElement('div');
	handle.className = 'folio-toc-resizer';
	handle.tabIndex = 0;
	handle.title = 'Drag to resize, double-click to reset';
	handle.setAttribute('role', 'separator');
	handle.setAttribute('aria-orientation', 'vertical');
	handle.setAttribute('aria-controls', 'folio-toc-nav');
	handle.setAttribute('aria-label', 'Resize contents');

	// Capture sends the drag's moves to the handle even when the pointer runs ahead of it.
	let dragging: number | undefined;
	handle.addEventListener('pointerdown', (event) => {
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		dragging = event.pointerId;
		try {
			handle.setPointerCapture(event.pointerId);
		} catch {
			// Not a live pointer (a synthetic event); moves over the handle still resize.
		}
		document.body.classList.add(RESIZING_CLASS);
	});
	handle.addEventListener('pointermove', (event) => {
		if (event.pointerId === dragging) {
			setWidth(event.clientX);
		}
	});
	const stop = (event: PointerEvent) => {
		if (event.pointerId !== dragging) {
			return;
		}
		dragging = undefined;
		if (handle.hasPointerCapture(event.pointerId)) {
			handle.releasePointerCapture(event.pointerId);
		}
		document.body.classList.remove(RESIZING_CLASS);
	};
	handle.addEventListener('pointerup', stop);
	handle.addEventListener('pointercancel', stop);
	handle.addEventListener('dblclick', () => document.documentElement.style.removeProperty(WIDTH_PROPERTY));
	handle.addEventListener('keydown', (event) => {
		const step = event.key === 'ArrowLeft' ? -KEY_STEP_PX : event.key === 'ArrowRight' ? KEY_STEP_PX : 0;
		if (step !== 0) {
			event.preventDefault();
			setWidth(aside.getBoundingClientRect().width + step);
		}
	});
	return handle;
}

function onEntryClick(event: MouseEvent): void {
	const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[data-index]');
	if (!link) {
		return;
	}
	// The heading is looked up by position: ids can repeat when other extensions embed documents.
	const heading = documentHeadings()[Number(link.dataset.index)];
	if (!heading) {
		return;
	}
	event.preventDefault();
	heading.scrollIntoView({ block: 'start' });
	if (window.innerWidth < NARROW_PX) {
		setOpen(false);
	}
}

function fill(entries: Entry[]): void {
	const items = entries.map((entry) => {
		const link = document.createElement('a');
		link.href = `#${encodeURIComponent(entry.id)}`;
		link.dataset.index = String(entry.index);
		link.textContent = entry.text;
		const item = document.createElement('li');
		item.className = `folio-toc-depth-${entry.depth}`;
		item.append(link);
		return item;
	});
	list!.replaceChildren(...items);
}

function removePanel(): void {
	panel?.remove();
	panel = list = toggle = undefined;
	shown = '';
	document.body.classList.remove(OPEN_CLASS);
}

/** Builds, updates or removes the panel to match the current document. */
export function updateToc(): void {
	const levels = Number(document.querySelector<HTMLElement>(CONFIG_SELECTOR)?.dataset.levels);
	const headings = documentHeadings().map((el) => ({
		level: Number(el.tagName.slice(1)),
		text: el.textContent ?? '',
		id: el.id,
	}));
	const entries = levels > 0 ? outline(headings, levels) : [];
	if (entries.length === 0) {
		removePanel();
		return;
	}
	panel ??= createPanel();
	const signature = JSON.stringify(entries);
	if (signature !== shown) {
		fill(entries);
		shown = signature;
	}
}
