#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SRC = path.resolve(__dirname, '..', 'nodes');
const DEST = path.resolve(__dirname, '..', 'dist', 'nodes');
const EXTENSIONS = new Set(['.svg', '.png']);

// Recursive walk that works reliably on Node 18+ (avoids
// Dirent.parentPath which was only added in Node 21.4).
let count = 0;

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
            continue;
        }
        if (!EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

        const relPath = path.relative(SRC, fullPath);
        const destFile = path.join(DEST, relPath);

        fs.mkdirSync(path.dirname(destFile), { recursive: true });
        fs.copyFileSync(fullPath, destFile);
        console.log(`  copied: ${relPath}`);
        count++;
    }
}

walk(SRC);
console.log(`copy-icons: ${count} file(s) copied to dist/nodes/`);
