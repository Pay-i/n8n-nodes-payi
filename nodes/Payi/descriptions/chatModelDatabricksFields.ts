import type { INodeProperties } from 'n8n-workflow';

export const chatModelDatabricksFields: INodeProperties[] = [
	{
		displayName: 'Serving Endpoint Name',
		name: 'endpointName',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The name of the Databricks Model Serving endpoint',
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'getServingEndpoints',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'name',
				type: 'string',
				placeholder: 'e.g. databricks-gpt-5-4',
			},
		],
	},
	{
		displayName: 'Deployed Model',
		name: 'deployedModel',
		type: 'string',
		default: '',
		placeholder: 'e.g. claude-sonnet-4-6, gpt-4o',
		description:
			'The underlying model deployed behind the serving endpoint. Required for custom endpoints; optional for pre-provisioned "databricks-" foundation models.',
	},
	{
		displayName: 'Cloud Provider',
		name: 'cloudProvider',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'AWS', value: 'aws' },
			{ name: 'Azure', value: 'azure' },
			{ name: 'Google Cloud (GCP)', value: 'google' },
			{ name: 'Databricks', value: 'databricks' },
		],
		default: 'aws',
		required: true,
		description:
			'The cloud provider where your Databricks workspace is hosted. Used for cost pricing. Azure workspaces (.azuredatabricks.net) are auto-detectable; AWS, GCP, and Databricks-hosted all use .cloud.databricks.com. Choose Databricks for self-hosted, on-premises, or non-major-cloud deployments.',
	},
	{
		displayName: 'Options',
		name: 'options',
		placeholder: 'Add Option',
		description: 'Additional options for the model',
		type: 'collection',
		default: {},
		options: [
			{
				displayName: 'Sampling Temperature',
				name: 'temperature',
				default: 0.7,
				typeOptions: { maxValue: 2, minValue: 0, numberPrecision: 1 },
				description:
					'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
				type: 'number',
			},
			{
				displayName: 'Maximum Number of Tokens',
				name: 'maxTokens',
				default: -1,
				description:
					'The maximum number of tokens to generate in the completion. Set to -1 for no limit.',
				type: 'number',
			},
			{
				displayName: 'Top P',
				name: 'topP',
				default: 1,
				typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
				description:
					'Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered. We generally recommend altering this or temperature but not both.',
				type: 'number',
			},
			{
				displayName: 'Frequency Penalty',
				name: 'frequencyPenalty',
				default: 0,
				typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
				description:
					"Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim",
				type: 'number',
			},
			{
				displayName: 'Presence Penalty',
				name: 'presencePenalty',
				default: 0,
				typeOptions: { maxValue: 2, minValue: -2, numberPrecision: 1 },
				description:
					"Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics",
				type: 'number',
			},
		],
	},
];
