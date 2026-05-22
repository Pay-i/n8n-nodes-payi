import type { INodeProperties } from 'n8n-workflow';

/**
 * Build the shared Pay-i tracking fields for a specific provider node.
 *
 * @param _providerName  Short provider tag used in the UseCase-ID
 *                       (e.g. "openai", "anthropic", "azure", "bedrock", "proxy").
 * @param _modelParam    Name of the node parameter that holds the model /
 *                       deployment identifier (e.g. "model" or "deploymentName").
 */
export function createTrackingFields(
	_providerName: string,
	_modelParam: string,
): INodeProperties[] {
	// Parameters reserved for future per-provider customization.
	return [
		{
			displayName: 'User ID',
			name: 'userId',
			type: 'string',
			default: '',
			description: 'User identifier for cost attribution',
		},
		{
			displayName: 'Use Case Name',
			name: 'useCaseName',
			type: 'string',
			default: `={{ $workflow.name.replaceAll(' ', '-') }}`,
			description:
				'Use case definition name for tracking and KPI scoring. Defaults to the workflow name (spaces replaced with hyphens).',
		},
		{
			displayName: 'Use Case ID',
			name: 'useCaseId',
			type: 'string',
			default: `={{ $nodeId }}`,
			description:
				'Unique identifier for this use case instance. Defaults to the n8n node ID — all runs of the same node aggregate under one Pay-i use case.',
		},
		{
			displayName: 'Use Case Step',
			name: 'useCaseStep',
			type: 'string',
			default: '={{ $node.name }}',
			description:
				'The step within the use case. Defaults to the node name on the canvas (e.g. "Step 1 - Outline").',
		},
		{
			displayName: 'Advanced Tracking',
			name: 'advancedTracking',
			placeholder: 'Add Option',
			description:
				'Additional tracking fields. These values should only be used or modified with guidance from Pay-i Support.',
			type: 'collection',
			default: {},
			options: [
				{
					displayName: 'Use Case Version',
					name: 'useCaseVersion',
					type: 'string',
					default: '',
					description: 'Version of the use case definition',
				},
				{
					displayName: 'Use Case Properties',
					name: 'useCaseProperties',
					type: 'json',
					default: '',
					description:
						'JSON object of key-value properties (e.g. {"department": "support"})',
				},
				{
					displayName: 'Limit IDs',
					name: 'limitIds',
					type: 'string',
					default: '',
					description: 'Comma-separated list of Pay-i limit IDs to enforce',
				},
				{
					displayName: 'Flatten Gemini Content',
					name: 'flattenContent',
					type: 'boolean',
					default: true,
					description:
						'Flatten Gemini content blocks into a plain text string (fixes Databricks schema translation issue). Disable if you need the raw content array preserved.',
				},
				{
					displayName: 'Debug Logging',
					name: 'debugLogging',
					type: 'boolean',
					default: false,
					description:
						'WARNING: Extremely verbose. Logs request URLs, headers, credential fields, and proxy routing details to the n8n server console. Should only be enabled with guidance from Pay-i Support.',
				},
			],
		},
	];
}
