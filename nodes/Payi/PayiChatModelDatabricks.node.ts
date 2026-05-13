 
import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { chatModelDatabricksFields } from './descriptions/chatModelDatabricksFields';
import { createTrackingFields } from './descriptions/trackingFields';

// Runtime-only modules provided by n8n's VM context — not available at compile time.
// Declared here so TypeScript accepts the require() calls.
declare function require(module: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any

// Node 18+ / browser globals used by the custom HTTP adapter below.
// These are present at runtime but not in our es2019 tsconfig lib.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const fetch: (input: string, init?: { method?: string; headers?: any; body?: any; signal?: any }) => Promise<{
	ok: boolean;
	status: number;
	text(): Promise<string>;
	json(): Promise<any>;
}>;
declare type Response = ReturnType<typeof fetch> extends Promise<infer T> ? T : never;
declare const AbortController: { new(): { signal: any; abort(): void } };
declare const setTimeout: (handler: () => void, ms: number) => any;
declare const clearTimeout: (id: any) => void;
/* eslint-enable @typescript-eslint/no-explicit-any */

// Pay-i now exposes a Databricks-native proxy path at
// `/api/v1/proxy/databricks/serving-endpoints/{endpoint}/invocations`.
// We point ChatOpenAI's baseURL at `.../serving-endpoints/{endpoint}` so its
// appended `/chat/completions` suffix maps to a path Pay-i can route.
//
// Default foundation model used as PriceAs-Resource fallback when the user's
// endpoint name doesn't follow the `databricks-*` foundation-model naming.
const DEFAULT_FOUNDATION_MODEL = 'databricks-gpt-5-4';
const FOUNDATION_PATTERN = /^databricks-/;

export class PayiChatModelDatabricks implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pay-i Databricks (Proxy)',
		name: 'lmChatPayiDatabricks',
		icon: 'file:payi_logo.png',
		group: ['transform'],
		version: [1],
		description:
			'Databricks Model Serving chat model routed through Pay-i proxy for cost tracking and budget enforcement',
		defaults: {
			name: 'Pay-i Databricks (Proxy)',
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
				name: 'payiDatabricksApi',
				required: true,
			},
		],
		properties: [
			...chatModelDatabricksFields,
			...createTrackingFields('databricks', 'endpointName'),
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		// Runtime imports — resolved through n8n's VM context, not bundled.
		// We build a custom ChatModel adapter (not ChatOpenAI) so we can hit
		// Pay-i's Databricks-native proxy path with `/invocations` suffix,
		// which ChatOpenAI doesn't allow (it hardcodes /chat/completions).
		const { BaseChatModel } = require('@langchain/core/language_models/chat_models');
		const { AIMessage } = require('@langchain/core/messages');
		const { N8nLlmTracing, makeN8nLlmFailedAttemptHandler } = require('@n8n/ai-utilities');
		// convertToOpenAITool handles LangChain StructuredTool / Zod / dict → OpenAI tool format
		let convertToOpenAITool: (tool: unknown) => unknown;
		try {
			convertToOpenAITool = require('@langchain/core/utils/function_calling').convertToOpenAITool;
		} catch {
			// Fallback: minimal converter if the utility isn't available in this n8n version
			convertToOpenAITool = (tool: unknown) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const t = tool as any;
				if (t?.type === 'function' && t?.function) return t;
				if (t?.name) {
					return {
						type: 'function',
						function: {
							name: t.name,
							description: t.description || '',
							parameters: t.parameters || t.schema || { type: 'object', properties: {} },
						},
					};
				}
				return t;
			};
		}

		const payiCredentials = await this.getCredentials('payiApi');
		const payiBaseUrl = (payiCredentials.baseUrl as string).replace(/\/+$/, '');
		const payiApiKey = payiCredentials.apiKey as string;

		const databricksCredentials = await this.getCredentials('payiDatabricksApi');
		const accessToken = databricksCredentials.accessToken as string;
		const workspaceUrl = (databricksCredentials.workspaceUrl as string).replace(/\/+$/, '');

		const endpointName = this.getNodeParameter('endpointName', itemIndex) as string;
		const cloudProvider = this.getNodeParameter('cloudProvider', itemIndex) as string;
		const priceAsResourceOverride = this.getNodeParameter('priceAsResource', itemIndex, '') as string;

		// PriceAs-Resource resolution:
		//   1. Explicit override → use it
		//   2. Foundation model name (starts with "databricks-") → use endpoint name
		//   3. Custom endpoint name → fall back to DEFAULT_FOUNDATION_MODEL
		let priceAsResource: string;
		if (priceAsResourceOverride.trim()) {
			priceAsResource = priceAsResourceOverride.trim();
		} else if (FOUNDATION_PATTERN.test(endpointName)) {
			priceAsResource = endpointName;
		} else {
			priceAsResource = DEFAULT_FOUNDATION_MODEL;
		}
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

		const timeout = options.timeout as number | undefined;

		// Final upstream URL — Pay-i's Databricks-native proxy path, lowercase /invocations.
		const invocationsUrl = `${payiBaseUrl}/api/v1/proxy/databricks/serving-endpoints/${encodeURIComponent(endpointName)}/invocations`;

		const defaultHeaders: Record<string, string> = {
			'xProxy-Api-Key': payiApiKey,
			'xProxy-Provider-BaseUri': workspaceUrl,
			'xProxy-PriceAs-Category': `system.databricks.${cloudProvider}`,
			'xProxy-PriceAs-Resource': priceAsResource,
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json',
			...trackingHeaders,
		};

		if (debugLogging) {
			const mask = (v: string) => v.length <= 8 ? '****' : v.substring(0, 8) + '****';
			this.logger.info(`[Pay-i Databricks] ──── DEBUG (item ${itemIndex}) ────`);
			this.logger.info(`[Pay-i Databricks] workspaceUrl="${workspaceUrl}"`);
			this.logger.info(`[Pay-i Databricks] endpoint="${endpointName}" cloud="${cloudProvider}"`);
			this.logger.info(`[Pay-i Databricks] priceAsResource="${priceAsResource}" (override="${priceAsResourceOverride}")`);
			this.logger.info(`[Pay-i Databricks] invocationsUrl="${invocationsUrl}"`);
			const masked = Object.fromEntries(
				Object.entries(defaultHeaders).map(([k, v]) =>
					['xProxy-Api-Key', 'Authorization'].includes(k) ? [k, mask(v)] : [k, v],
				),
			);
			this.logger.info(`[Pay-i Databricks] Headers: ${JSON.stringify(masked, null, 2)}`);
		}

		// Capture for use inside the adapter class (closure)
		const logger = this.logger;
		const modelOptions = options;
		const modelTimeout = timeout;

		// Custom LangChain chat model that hits Pay-i's /invocations URL directly.
		// Handles both response shapes:
		//   - OpenAI shape: { choices: [{ message: { content } }], usage: {...} }
		//   - Native shape: { predictions: [...] }
		class PayiDatabricksNativeChatModel extends BaseChatModel {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			boundTools: any[] = [];
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			boundToolChoice: any = undefined;

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			constructor(fields: any) {
				super(fields);
			}

			_llmType(): string {
				return 'payi-databricks-native';
			}

			// LangChain Tools Agent calls this. We clone ourselves with the tools attached
			// and convert them to OpenAI tool format (Databricks foundation models accept it).
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			bindTools(tools: any[], kwargs?: any): any {
				const cloned = Object.create(Object.getPrototypeOf(this)) as PayiDatabricksNativeChatModel;
				Object.assign(cloned, this);
				cloned.boundTools = (tools || []).map((t) => convertToOpenAITool(t));
				cloned.boundToolChoice = kwargs?.tool_choice;
				return cloned;
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			async _generate(messages: any[], _options: any, _runManager: any): Promise<any> {
				// Convert LangChain messages → OpenAI-shape message array
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const openaiMessages = messages.map((msg: any) => {
					const type = typeof msg._getType === 'function' ? msg._getType() : (msg.type || 'human');
					let role = 'user';
					if (type === 'system') role = 'system';
					else if (type === 'ai' || type === 'AIMessage') role = 'assistant';
					return { role, content: msg.content };
				});

				const body: Record<string, unknown> = { messages: openaiMessages };
				if (modelOptions.temperature !== undefined) body.temperature = modelOptions.temperature;
				if (modelOptions.maxTokens !== undefined && modelOptions.maxTokens !== -1) {
					body.max_tokens = modelOptions.maxTokens;
				}
				if (modelOptions.topP !== undefined) body.top_p = modelOptions.topP;
				if (modelOptions.frequencyPenalty !== undefined) body.frequency_penalty = modelOptions.frequencyPenalty;
				if (modelOptions.presencePenalty !== undefined) body.presence_penalty = modelOptions.presencePenalty;

				// Tools binding — pass any tools the AI Agent attached via bindTools()
				if (this.boundTools && this.boundTools.length > 0) {
					body.tools = this.boundTools;
					if (this.boundToolChoice !== undefined) body.tool_choice = this.boundToolChoice;
				}

				const controller = modelTimeout ? new AbortController() : null;
				const timeoutId = (controller && modelTimeout)
					? setTimeout(() => controller.abort(), modelTimeout)
					: null;

				let response: Response;
				try {
					response = await fetch(invocationsUrl, {
						method: 'POST',
						headers: defaultHeaders,
						body: JSON.stringify(body),
						signal: controller?.signal,
					});
				} finally {
					if (timeoutId) clearTimeout(timeoutId);
				}

				if (!response.ok) {
					const errorText = await response.text();
					logger.error(`[Pay-i Databricks] HTTP ${response.status}: ${errorText.substring(0, 500)}`);
					throw new Error(`Pay-i Databricks request failed (HTTP ${response.status}): ${errorText.substring(0, 500)}`);
				}

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const data: any = await response.json();

				// Parse response — handle OpenAI shape (with tool_calls) AND native predictions[] shape
				let content: string;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				let toolCalls: any[] | undefined;
				let promptTokens = 0;
				let completionTokens = 0;
				let totalTokens = 0;

				if (data?.choices?.[0]?.message) {
					// OpenAI shape (foundation models, custom chat-completion endpoints)
					const msg = data.choices[0].message;
					content = msg.content != null ? String(msg.content) : '';
					toolCalls = msg.tool_calls;
					promptTokens = data.usage?.prompt_tokens || 0;
					completionTokens = data.usage?.completion_tokens || 0;
					totalTokens = data.usage?.total_tokens || (promptTokens + completionTokens);
				} else if (Array.isArray(data?.predictions)) {
					// Native MLflow shape — stringify predictions for downstream use
					const first = data.predictions[0];
					content = typeof first === 'string' ? first : JSON.stringify(data.predictions);
					// Native responses don't include usage data
				} else {
					// Unknown shape — return raw JSON, log warning
					logger.warn(`[Pay-i Databricks] Unrecognized response shape, returning raw: ${JSON.stringify(data).substring(0, 200)}`);
					content = JSON.stringify(data);
				}

				if (debugLogging) {
					logger.info(`[Pay-i Databricks] Response usage: prompt=${promptTokens} completion=${completionTokens} total=${totalTokens} tool_calls=${toolCalls ? toolCalls.length : 0}`);
				}

				// Build AIMessage — if tool_calls present, attach them so the AI Agent can route to tools
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const messageOpts: any = { content };
				if (toolCalls && toolCalls.length > 0) {
					messageOpts.tool_calls = toolCalls;
					messageOpts.additional_kwargs = { tool_calls: toolCalls };
				}
				const aiMessage = new AIMessage(messageOpts);

				return {
					generations: [{
						text: content,
						message: aiMessage,
					}],
					llmOutput: {
						tokenUsage: {
							promptTokens,
							completionTokens,
							totalTokens,
						},
					},
				};
			}
		}

		const model = new PayiDatabricksNativeChatModel({
			callbacks: [new N8nLlmTracing(this)],
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this),
		});

		return {
			response: model,
		};
	}
}
