import type { INodeProperties } from 'n8n-workflow';

// Update on each release. Keep in sync with package.json.
const PACKAGE_VERSION = '1.0.5';

// Kept as an array so node files can spread (...versionNotice) — leaves
// room to expand to multi-line later without changing every node file.
export const versionNotice: INodeProperties[] = [
	{
		displayName: `Current Pay-i Node Version: ${PACKAGE_VERSION}`,
		name: 'versionNotice',
		type: 'notice',
		default: '',
	},
];
