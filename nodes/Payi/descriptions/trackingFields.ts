import type { INodeProperties } from 'n8n-workflow';

/**
 * Build the shared Pay-i tracking fields for a specific provider node.
 *
 * @param providerName  Short provider tag used in the UseCase-ID
 *                      (e.g. "openai", "anthropic", "azure", "bedrock", "proxy").
 * @param modelParam    Name of the node parameter that holds the model /
 *                      deployment identifier (e.g. "model" or "deploymentName").
 */
export function createTrackingFields(
	providerName: string,
	modelParam: string,
): INodeProperties[] {
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
			default: `={{ '${providerName}/' + $parameter.${modelParam} + '/' + $execution.id }}`,
			description:
				'Unique identifier for this use case instance. Defaults to provider/model/executionId.',
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
