import type { INodeProperties } from 'n8n-workflow';

export const chatModelAnthropicFields: INodeProperties[] = [
	{
		displayName: 'Model',
		name: 'model',
		type: 'string',
		default: 'claude-sonnet-4-6',
		required: true,
		placeholder: 'e.g. claude-sonnet-4-6, claude-opus-4-6',
		description: 'The Anthropic model ID to use',
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
				displayName: 'Maximum Number of Tokens',
				name: 'maxTokensToSample',
				default: 4096,
				description:
					'The maximum number of tokens to generate in the completion',
				type: 'number',
			},
			{
				displayName: 'Sampling Temperature',
				name: 'temperature',
				default: 0.7,
				typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
				description:
					'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
				type: 'number',
				displayOptions: {
					hide: {
						thinking: [true],
					},
				},
			},
			{
				displayName: 'Top K',
				name: 'topK',
				default: -1,
				typeOptions: { maxValue: 1, minValue: -1, numberPrecision: 1 },
				description:
					'Used to remove "long tail" low probability responses. Defaults to -1, which disables it.',
				type: 'number',
				displayOptions: {
					hide: {
						thinking: [true],
					},
				},
			},
			{
				displayName: 'Top P',
				name: 'topP',
				default: 1,
				typeOptions: { maxValue: 1, minValue: 0, numberPrecision: 1 },
				description:
					'Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered. We generally recommend altering this or temperature but not both.',
				type: 'number',
				displayOptions: {
					hide: {
						thinking: [true],
					},
				},
			},
			{
				displayName: 'Enable Thinking',
				name: 'thinking',
				type: 'boolean',
				default: false,
				description:
					'Whether to enable extended thinking / reasoning mode for the model',
			},
			{
				displayName: 'Thinking Budget (Tokens)',
				name: 'thinkingBudget',
				type: 'number',
				default: 10000,
				typeOptions: { minValue: 1024 },
				description:
					'The maximum number of tokens the model may use for thinking. Minimum 1024.',
				displayOptions: {
					show: {
						thinking: [true],
					},
				},
			},
		],
	},
];
