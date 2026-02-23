import type { INodeProperties } from 'n8n-workflow';

export const trackingFields: INodeProperties[] = [
	{
		displayName: 'xProxy-User-ID',
		name: 'userId',
		type: 'string',
		default: '',
		description: 'User identifier for cost attribution',
	},
	{
		displayName: 'xProxy-UseCase-Name',
		name: 'useCaseName',
		type: 'string',
		default: '={{ $workflow.name }}',
		description:
			'Use case definition name for tracking and KPI scoring. Defaults to the workflow name.',
	},
	{
		displayName: 'xProxy-UseCase-ID',
		name: 'useCaseId',
		type: 'string',
		default: '={{ $execution.id }}',
		description:
			'Unique identifier for this use case instance. Defaults to the n8n execution ID. Same name + ID groups requests for KPI scoring.',
	},
	{
		displayName: 'xProxy-UseCase-Version',
		name: 'useCaseVersion',
		type: 'string',
		default: '',
		description: 'Version of the use case definition',
	},
	{
		displayName: 'xProxy-UseCase-Step',
		name: 'useCaseStep',
		type: 'string',
		default: '',
		description: 'The step within the use case (e.g. for multi-step workflows)',
	},
	{
		displayName: 'xProxy-UseCase-Properties',
		name: 'useCaseProperties',
		type: 'json',
		default: '',
		description:
			'JSON object of key-value properties (e.g. {"department": "support"})',
	},
	{
		displayName: 'xProxy-Limit-IDs',
		name: 'limitIds',
		type: 'string',
		default: '',
		description: 'Comma-separated list of Pay-i limit IDs to enforce',
	},
];
