/* eslint-disable @typescript-eslint/no-var-requires */
import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { chatModelFields } from './descriptions/chatModelFields';
import { trackingFields } from './descriptions/trackingFields';

// Runtime-only modules provided by n8n's VM context — not available at compile time.
// Declared here so TypeScript accepts the require() calls.
declare function require(module: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any

export class PayiChatModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pay-i Chat Model',
		name: 'lmChatPayi',
		icon: 'file:payi.png',
		group: ['transform'],
		version: [1],
		description: 'Chat model routed through Pay-i proxy for cost tracking and budget enforcement',
		defaults: {
			name: 'Pay-i Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
		},
		inputs: [],
		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'payiApi',
				required: true,
			},
		],
		properties: [
			...chatModelFields,
			...trackingFields,
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		// Runtime imports — resolved through n8n's VM context, not bundled
		const { ChatOpenAI } = require('@langchain/openai');
		const { N8nLlmTracing, makeN8nLlmFailedAttemptHandler } = require('@n8n/ai-utilities');

		const credentials = await this.getCredentials('payiApi');
		const payiBaseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');
		const payiApiKey = credentials.apiKey as string;

		const providerApiKey = this.getNodeParameter('providerApiKey', itemIndex) as string;
		const modelName = this.getNodeParameter('model', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as Record<string, unknown>;

		// Build tracking headers
		const trackingHeaders: Record<string, string> = {};
		const userId = this.getNodeParameter('userId', itemIndex, '') as string;
		const useCaseName = this.getNodeParameter('useCaseName', itemIndex, '') as string;
		const useCaseId = this.getNodeParameter('useCaseId', itemIndex, '') as string;
		const useCaseVersion = this.getNodeParameter('useCaseVersion', itemIndex, '') as string;
		const useCaseStep = this.getNodeParameter('useCaseStep', itemIndex, '') as string;
		const useCaseProperties = this.getNodeParameter('useCaseProperties', itemIndex, '') as string;
		const limitIds = this.getNodeParameter('limitIds', itemIndex, '') as string;

		if (userId) trackingHeaders['xProxy-User-ID'] = userId;
		if (useCaseName) trackingHeaders['xProxy-UseCase-Name'] = useCaseName;
		if (useCaseId) trackingHeaders['xProxy-UseCase-ID'] = useCaseId;
		if (useCaseVersion) trackingHeaders['xProxy-UseCase-Version'] = useCaseVersion;
		if (useCaseStep) trackingHeaders['xProxy-UseCase-Step'] = useCaseStep;
		if (useCaseProperties) {
			trackingHeaders['xProxy-UseCase-Properties'] = useCaseProperties;
		}
		if (limitIds) trackingHeaders['xProxy-Limit-IDs'] = limitIds;

		const timeout = options.timeout as number | undefined;

		const model = new ChatOpenAI({
			apiKey: providerApiKey,
			model: modelName,
			...options,
			timeout,
			maxRetries: (options.maxRetries as number) ?? 2,
			configuration: {
				baseURL: `${payiBaseUrl}/api/v1/proxy/openai/v1`,
				defaultHeaders: {
					'xProxy-Api-Key': payiApiKey,
					...trackingHeaders,
				},
			},
			callbacks: [new N8nLlmTracing(this)],
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this),
		});

		return {
			response: model,
		};
	}
}
