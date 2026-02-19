import type { INodeProperties } from 'n8n-workflow';

export const providerFields: INodeProperties[] = [
	{
		displayName: 'Provider',
		name: 'provider',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'OpenAI', value: 'openai' },
			{ name: 'Anthropic', value: 'anthropic' },
			{ name: 'Azure OpenAI', value: 'azureOpenai' },
			{ name: 'AWS Bedrock', value: 'bedrock' },
		],
		default: 'openai',
		description: 'The LLM provider to route through Pay-i',
	},
	{
		displayName: 'Model Provider API Key',
		name: 'providerApiKey',
		type: 'string',
		typeOptions: { password: true },
		default: '',
		required: true,
		description: 'API key or access token for the selected provider',
	},
	{
		displayName: 'Model ID',
		name: 'model',
		type: 'string',
		default: 'gpt-4o',
		required: true,
		placeholder: 'e.g. gpt-4o, claude-sonnet-4-20250514',
		description: 'The model ID to use',
	},
	// Azure extras
	{
		displayName: 'Azure Deployment Name',
		name: 'azureDeploymentName',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. my-gpt-4o-deployment',
		displayOptions: { show: { provider: ['azureOpenai'] } },
	},
	{
		displayName: 'Azure API Version',
		name: 'azureApiVersion',
		type: 'string',
		default: '2024-02-01',
		displayOptions: { show: { provider: ['azureOpenai'] } },
	},
	// Bedrock extras
	{
		displayName: 'AWS Secret Access Key',
		name: 'bedrockSecretKey',
		type: 'string',
		typeOptions: { password: true },
		default: '',
		required: true,
		displayOptions: { show: { provider: ['bedrock'] } },
	},
	{
		displayName: 'AWS Session Token',
		name: 'bedrockSessionToken',
		type: 'string',
		typeOptions: { password: true },
		default: '',
		description: 'Optional — for temporary AWS credentials',
		displayOptions: { show: { provider: ['bedrock'] } },
	},
	{
		displayName: 'AWS Region',
		name: 'bedrockRegion',
		type: 'string',
		default: 'us-east-1',
		displayOptions: { show: { provider: ['bedrock'] } },
	},
];
