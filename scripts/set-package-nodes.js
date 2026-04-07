#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const mode = process.argv[2]; // 'cloud' or 'selfhosted'
if (!mode || !['cloud', 'selfhosted'].includes(mode)) {
	console.error('Usage: set-package-nodes.js <cloud|selfhosted>');
	process.exit(1);
}

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const CLOUD_NODES = [
	'dist/nodes/Payi/Payi.node.js',
];

const SELFHOSTED_NODES = [
	'dist/nodes/Payi/Payi.node.js',
	'dist/nodes/Payi/PayiChatModel.node.js',
	'dist/nodes/Payi/PayiChatModelAnthropic.node.js',
	'dist/nodes/Payi/PayiChatModelAzure.node.js',
	'dist/nodes/Payi/PayiChatModelBedrock.node.js',
	'dist/nodes/Payi/PayiChatModelDatabricks.node.js',
];

pkg.n8n.nodes = mode === 'selfhosted' ? SELFHOSTED_NODES : CLOUD_NODES;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, '\t') + '\n');
console.log(`set-package-nodes: configured for ${mode} (${pkg.n8n.nodes.length} node(s))`);
