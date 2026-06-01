 
import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { chatModelFields } from './descriptions/chatModelFields';
import { createTrackingFields } from './descriptions/trackingFields';
import { versionNotice } from './descriptions/versionNotice';
import { sanitizeHeaderValue } from './utils/headers';

// Runtime-only modules provided by n8n's VM context — not available at compile time.
// Declared here so TypeScript accepts the require() calls.
declare function require(module: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any

export class PayiChatModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pay-i OpenAI (Proxy)',
		name: 'lmChatPayi',
		icon: 'file:payi_logo.png',
		group: ['transform'],
		version: [1],
		description: 'OpenAI chat model routed through Pay-i proxy for cost tracking and budget enforcement',
		defaults: {
			name: 'Pay-i OpenAI (Proxy)',
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
			{
				name: 'openAiApi',
				required: true,
			},
		],
		properties: [
			...chatModelFields,
			...createTrackingFields('openai', 'model', 'Pay-i OpenAI (Proxy)'),
			...versionNotice,
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		// Runtime imports — resolved through n8n's VM context, not bundled
		const { ChatOpenAI } = require('@langchain/openai');
		const { N8nLlmTracing, makeN8nLlmFailedAttemptHandler } = require('@n8n/ai-utilities');

		const payiCredentials = await this.getCredentials('payiApi');
		const payiBaseUrl = (payiCredentials.baseUrl as string).replace(/\/+$/, '');
		const payiApiKey = payiCredentials.apiKey as string;

		const providerCredentials = await this.getCredentials('openAiApi');
		const providerApiKey = providerCredentials.apiKey as string;
		const modelName = this.getNodeParameter('model', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as Record<string, unknown>;

		// Build tracking headers
		const trackingHeaders: Record<string, string> = {};
		const userId = this.getNodeParameter('userId', itemIndex, '') as string;
		const useCaseName = this.getNodeParameter('useCaseName', itemIndex, '') as string;
		const useCaseId = this.getNodeParameter('useCaseId', itemIndex, '') as string;
		// Advanced tracking fields (collapsed in UI under "Advanced Tracking")
		const advancedTracking = this.getNodeParameter('advancedTracking', itemIndex, {}) as Record<string, string>;
		const useCaseVersion = advancedTracking.useCaseVersion || '';
		// Canvas display name (e.g. "Pay-i OpenAI #4 - Summarizer") is more useful in
		// Pay-i's dashboard than the generic node-type label. If the user hasn't
		// changed the parameter from its hard-coded default, swap in the canvas name.
		let useCaseStep = this.getNodeParameter('useCaseStep', itemIndex, '') as string;
		if (!useCaseStep || useCaseStep === 'Pay-i OpenAI (Proxy)') {
			useCaseStep = this.getNode().name;
		}
		const useCaseProperties = advancedTracking.useCaseProperties || '';
		const limitIds = advancedTracking.limitIds || '';
		const debugLogging = !!(advancedTracking as Record<string, unknown>).debugLogging;

		if (userId) trackingHeaders['xProxy-User-ID'] = sanitizeHeaderValue(userId);
		if (useCaseName) trackingHeaders['xProxy-UseCase-Name'] = sanitizeHeaderValue(useCaseName);
		if (useCaseId) trackingHeaders['xProxy-UseCase-ID'] = sanitizeHeaderValue(useCaseId);
		if (useCaseVersion) trackingHeaders['xProxy-UseCase-Version'] = sanitizeHeaderValue(useCaseVersion);
		if (useCaseStep) trackingHeaders['xProxy-UseCase-Step'] = sanitizeHeaderValue(useCaseStep);
		if (useCaseProperties) {
			trackingHeaders['xProxy-UseCase-Properties'] = sanitizeHeaderValue(useCaseProperties);
		}
		if (limitIds) trackingHeaders['xProxy-Limit-IDs'] = sanitizeHeaderValue(limitIds);

		const timeout = options.timeout as number | undefined;
		const baseURL = `${payiBaseUrl}/api/v1/proxy/openai/v1`;
		const defaultHeaders: Record<string, string> = {
			'xProxy-Api-Key': payiApiKey,
			'xProxy-PriceAs-Resource': modelName,
			...trackingHeaders,
		};

		if (debugLogging) {
			const mask = (v: string) => v.length <= 8 ? '****' : v.substring(0, 8) + '****';
			this.logger.info(`[Pay-i OpenAI] ──── DEBUG (item ${itemIndex}) ────`);
			this.logger.info(`[Pay-i OpenAI] model="${modelName}" baseURL="${baseURL}"`);
			const masked = Object.fromEntries(
				Object.entries(defaultHeaders).map(([k, v]) =>
					k === 'xProxy-Api-Key' ? [k, mask(v)] : [k, v],
				),
			);
			this.logger.info(`[Pay-i OpenAI] Headers: ${JSON.stringify(masked, null, 2)}`);
		}

		const model = new ChatOpenAI({
			apiKey: providerApiKey,
			model: modelName,
			...options,
			timeout,
			maxRetries: (options.maxRetries as number) ?? 2,
			configuration: {
				baseURL,
				defaultHeaders,
			},
			callbacks: [new N8nLlmTracing(this)],
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this),
		});

		return {
			response: model,
		};
	}
}
