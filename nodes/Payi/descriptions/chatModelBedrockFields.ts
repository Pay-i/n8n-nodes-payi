import type { INodeProperties } from 'n8n-workflow';

export const chatModelBedrockFields: INodeProperties[] = [
	{
		displayName: 'Model ID',
		name: 'model',
		type: 'string',
		default: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
		required: true,
		placeholder:
			'e.g. anthropic.claude-3-5-sonnet-20241022-v2:0, meta.llama3-70b-instruct-v1:0',
		description: 'The Bedrock model ID to use',
	},
	{
		displayName: 'AWS Region',
		name: 'region',
		type: 'string',
		default: 'us-east-1',
		required: true,
		description: 'The AWS region where the Bedrock model is deployed (overrides the region in your AWS credentials)',
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
				typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
				description:
					'Controls randomness: Lowering results in less random completions',
				type: 'number',
			},
			{
				displayName: 'Maximum Number of Tokens',
				name: 'maxTokens',
				default: 4096,
				description:
					'The maximum number of tokens to generate in the completion',
				type: 'number',
			},
			{
				displayName: 'Top P',
				name: 'topP',
				default: 1,
				typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
				description:
					'Controls diversity via nucleus sampling',
				type: 'number',
			},
		],
	},
];
