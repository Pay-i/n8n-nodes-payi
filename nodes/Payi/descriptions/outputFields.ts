import type { INodeProperties } from 'n8n-workflow';

export const outputFields: INodeProperties[] = [
	{
		displayName: 'Include Cost Data',
		name: 'includeCostData',
		type: 'boolean',
		default: true,
		description:
			'Whether to include Pay-i cost tracking data (payiCost) in the output. When disabled, cost data is stripped from the response.',
	},
	{
		displayName: 'Return Full Response',
		name: 'returnFullResponse',
		type: 'boolean',
		default: false,
		description:
			'Whether to include HTTP status code and response headers in the output',
	},
	{
		displayName: 'Debug Logging',
		name: 'debugLogging',
		type: 'boolean',
		default: false,
		description:
			'Whether to log request details (URL, headers, response) to the n8n console. API keys are masked. Body content is redacted to shapes only. Disable in production.',
	},
];
