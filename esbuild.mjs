import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const shared = {
	bundle: true,
	minify: production,
	sourcemap: !production,
	logLevel: 'info',
};

const contexts = await Promise.all([
	// Extension host: CommonJS on Node, `vscode` provided by the host.
	esbuild.context({
		...shared,
		entryPoints: ['src/extension.ts'],
		outfile: 'dist/extension.js',
		platform: 'node',
		format: 'cjs',
		target: 'node20',
		external: ['vscode'],
	}),
	// Preview webview: one classic script (previewScripts are not loaded as modules), so mermaid's
	// lazily imported diagram chunks are bundled inline.
	esbuild.context({
		...shared,
		entryPoints: ['src/preview/index.ts'],
		outfile: 'dist/preview.js',
		platform: 'browser',
		format: 'iife',
		target: 'chrome120',
	}),
]);

if (watch) {
	await Promise.all(contexts.map((ctx) => ctx.watch()));
} else {
	await Promise.all(contexts.map((ctx) => ctx.rebuild()));
	await Promise.all(contexts.map((ctx) => ctx.dispose()));
}
