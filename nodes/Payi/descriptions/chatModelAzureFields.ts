import type { INodeProperties } from 'n8n-workflow';

export const chatModelAzureFields: INodeProperties[] = [
	{
		displayName: 'Deployment Name',
		name: 'deploymentName',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. gpt-4o, my-gpt4-deployment',
		description: 'The Azure OpenAI deployment name (not the model name)',
	},
	{
		displayName: 'API Version',
		name: 'apiVersion',
		type: 'string',
		default: '2024-08-01-preview',
		required: true,
		description:
			'The Azure OpenAI API version to use (falls back to the version from your Azure credential if blank)',
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
					'The maximum number of tokens to generate in the completion. Most models have a context length of 2048 tokens (except for the newest models, which support 4096). Set to -1 for no limit.',
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
