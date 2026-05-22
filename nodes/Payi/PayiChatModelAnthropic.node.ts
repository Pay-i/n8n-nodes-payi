 
import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { chatModelAnthropicFields } from './descriptions/chatModelAnthropicFields';
import { createTrackingFields } from './descriptions/trackingFields';

// Runtime-only modules provided by n8n's VM context — not available at compile time.
// Declared here so TypeScript accepts the require() calls.
declare function require(module: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any

export class PayiChatModelAnthropic implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pay-i Anthropic (Proxy)',
		name: 'lmChatPayiAnthropic',
		icon: 'file:payi_logo.png',
		group: ['transform'],
		version: [1],
		description:
			'Anthropic chat model routed through Pay-i proxy for cost tracking and budget enforcement',
		defaults: {
			name: 'Pay-i Anthropic (Proxy)',
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
				name: 'anthropicApi',
				required: true,
			},
		],
		properties: [
			...chatModelAnthropicFields,
			...createTrackingFields('anthropic', 'model', 'Pay-i Anthropic (Proxy)'),
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		// Runtime imports — resolved through n8n's VM context, not bundled
		const { ChatAnthropic } = require('@langchain/anthropic');
		const { N8nLlmTracing, makeN8nLlmFailedAttemptHandler } = require('@n8n/ai-utilities');

		const payiCredentials = await this.getCredentials('payiApi');
		const payiBaseUrl = (payiCredentials.baseUrl as string).replace(/\/+$/, '');
		const payiApiKey = payiCredentials.apiKey as string;

		const providerCredentials = await this.getCredentials('anthropicApi');
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
		const useCaseStep = this.getNodeParameter('useCaseStep', itemIndex, '') as string;
		const useCaseProperties = advancedTracking.useCaseProperties || '';
		const limitIds = advancedTracking.limitIds || '';
		const debugLogging = !!(advancedTracking as Record<string, unknown>).debugLogging;

		if (userId) trackingHeaders['xProxy-User-ID'] = userId;
		if (useCaseName) trackingHeaders['xProxy-UseCase-Name'] = useCaseName;
		if (useCaseId) trackingHeaders['xProxy-UseCase-ID'] = useCaseId;
		if (useCaseVersion) trackingHeaders['xProxy-UseCase-Version'] = useCaseVersion;
		if (useCaseStep) trackingHeaders['xProxy-UseCase-Step'] = useCaseStep;
		if (useCaseProperties) {
			trackingHeaders['xProxy-UseCase-Properties'] = useCaseProperties;
		}
		if (limitIds) trackingHeaders['xProxy-Limit-IDs'] = limitIds;

		// Token usage parser for Anthropic response format
		const tokensUsageParser = (result: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
			const usage = result?.llmOutput?.usage ?? {
				input_tokens: 0,
				output_tokens: 0,
			};
			return {
				completionTokens: usage.output_tokens,
				promptTokens: usage.input_tokens,
				totalTokens: usage.input_tokens + usage.output_tokens,
			};
		};

		// Handle thinking / extended reasoning mode
		let invocationKwargs: Record<string, unknown> = {};
		if (options.thinking) {
			invocationKwargs = {
				thinking: {
					type: 'enabled',
					budget_tokens: (options.thinkingBudget as number) ?? 10000,
				},
				max_tokens: (options.maxTokensToSample as number) ?? 4096,
				temperature: undefined,
				top_k: undefined,
				top_p: undefined,
			};
		}

		const anthropicBaseUrl = `${payiBaseUrl}/api/v1/proxy/anthropic`;
		const defaultHeaders: Record<string, string> = {
			'xProxy-Api-Key': payiApiKey,
			'xProxy-PriceAs-Resource': modelName,
			...trackingHeaders,
		};

		if (debugLogging) {
			const mask = (v: string) => v.length <= 8 ? '****' : v.substring(0, 8) + '****';
			this.logger.info(`[Pay-i Anthropic] ──── DEBUG (item ${itemIndex}) ────`);
			this.logger.info(`[Pay-i Anthropic] model="${modelName}" baseURL="${anthropicBaseUrl}"`);
			const masked = Object.fromEntries(
				Object.entries(defaultHeaders).map(([k, v]) =>
					k === 'xProxy-Api-Key' ? [k, mask(v)] : [k, v],
				),
			);
			this.logger.info(`[Pay-i Anthropic] Headers: ${JSON.stringify(masked, null, 2)}`);
			if (options.thinking) {
				this.logger.info(`[Pay-i Anthropic] Thinking mode enabled, budget=${(options.thinkingBudget as number) ?? 10000}`);
			}
		}

		const model = new ChatAnthropic({
			anthropicApiKey: providerApiKey,
			model: modelName,
			anthropicApiUrl: anthropicBaseUrl,
			maxTokens: options.maxTokensToSample as number | undefined,
			temperature: options.temperature as number | undefined,
			topK: options.topK as number | undefined,
			topP: options.topP as number | undefined,
			invocationKwargs,
			clientOptions: {
				defaultHeaders,
			},
			callbacks: [new N8nLlmTracing(this, { tokensUsageParser })],
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this),
		});

		// Clean up undefined topP / temperature so the SDK doesn't send them
		if (options.topP === undefined) {
			delete (model as any).topP; // eslint-disable-line @typescript-eslint/no-explicit-any
		}
		if (options.topP !== undefined && options.temperature === undefined) {
			delete (model as any).temperature; // eslint-disable-line @typescript-eslint/no-explicit-any
		}

		return {
			response: model,
		};
	}
}
