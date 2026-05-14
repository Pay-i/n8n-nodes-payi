import type { INodeProperties } from 'n8n-workflow';

export const chatModelDatabricksFields: INodeProperties[] = [
	{
		displayName: 'Serving Endpoint Name',
		name: 'endpointName',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description:
			'The Databricks Model Serving endpoint to invoke. Pick from the live list (loaded via the Databricks workspace API) or type the name directly. Sent as the "model" field in the request body so Databricks can route internally. The endpoint must accept OpenAI-shape chat/completions requests; foundation models do, raw MLflow tensor endpoints do not (Body Format support comes in 0.4.0).',
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
				placeholder: 'e.g. databricks-meta-llama-3-3-70b-instruct, databricks-gpt-5-4',
			},
		],
	},
	{
		displayName: 'Deployed Model',
		name: 'priceAsResource',
		type: 'string',
		default: '',
		placeholder: 'e.g. claude-sonnet-4-6, gpt-4o, databricks-gpt-5-4',
		description:
			'The underlying foundation model deployed behind this serving endpoint. Sent as the xProxy-PriceAs-Resource header for cost lookup (does not change routing — only Pay-i\'s pricing). Leave empty when the Serving Endpoint Name already matches a known Databricks foundation model registered in Pay-i\'s pricing tables. Set this when your endpoint is a custom wrapper (e.g. endpoint "payi-devorg" wrapping "databricks-gpt-5-4") so Pay-i resolves per-model pricing instead of marking the call as unknown.',
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
