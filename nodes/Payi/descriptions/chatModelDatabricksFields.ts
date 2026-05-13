import type { INodeProperties } from 'n8n-workflow';

export const chatModelDatabricksFields: INodeProperties[] = [
	{
		displayName: 'Serving Endpoint Name (Model)',
		name: 'endpointName',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. databricks-meta-llama-3-3-70b-instruct, databricks-gpt-5-4',
		description:
			'The name of the Databricks Model Serving endpoint. Sent as the "model" field in the request body. Databricks reads this value to route the request to the named endpoint. The proxy URL is always /serving-endpoints/chat/completions — Databricks does the internal routing based on this field. The endpoint must accept OpenAI-shape chat/completions requests (foundation models do; custom MLflow / tensor models do NOT — for those, see the Body Format support coming in 0.4.0).',
	},
	{
		displayName: 'Price-As Resource (Optional)',
		name: 'priceAsResource',
		type: 'string',
		default: '',
		placeholder: 'e.g. databricks-gpt-5-4 (leave empty for foundation models)',
		description:
			'Sent as the xProxy-PriceAs-Resource HEADER (does not change routing — only Pay-i\'s cost-tracking lookup). Leave empty when the Serving Endpoint Name already matches a known Databricks foundation model registered in Pay-i\'s pricing tables. Set this when your endpoint is a custom wrapper around a foundation model (e.g. endpoint name "payi-devorg" but the underlying model is "databricks-gpt-5-4") so Pay-i resolves per-model pricing instead of marking the call as an unknown resource. Important: this field is metadata only — it does NOT affect which endpoint Databricks invokes; that\'s determined by the Serving Endpoint Name field.',
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
