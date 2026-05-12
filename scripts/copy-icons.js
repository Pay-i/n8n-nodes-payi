#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const EXTENSIONS = new Set(['.svg', '.png', '.json']);

const DIRS = [
	{ src: path.join(ROOT, 'nodes'), dest: path.join(ROOT, 'dist', 'nodes') },
	{ src: path.join(ROOT, 'credentials'), dest: path.join(ROOT, 'dist', 'credentials') },
];

let count = 0;

function walk(srcRoot, destRoot, dir) {
	dir = dir || srcRoot;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(srcRoot, destRoot, fullPath);
			continue;
		}
		if (!EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

		const relPath = path.relative(srcRoot, fullPath);
		const destFile = path.join(destRoot, relPath);

		fs.mkdirSync(path.dirname(destFile), { recursive: true });
		fs.copyFileSync(fullPath, destFile);
		console.log(`  copied: ${relPath}`);
		count++;
	}
}

for (const { src, dest } of DIRS) {
	if (fs.existsSync(src)) walk(src, dest);
}

console.log(`copy-icons: ${count} file(s) copied to dist/`);
