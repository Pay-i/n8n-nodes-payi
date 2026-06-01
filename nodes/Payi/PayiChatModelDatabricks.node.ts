import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	ILoadOptionsFunctions,
	INodeListSearchResult,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import * as fs from 'fs';
import * as path from 'path';

import { chatModelDatabricksFields } from './descriptions/chatModelDatabricksFields';
import { createTrackingFields } from './descriptions/trackingFields';
import { versionNotice } from './descriptions/versionNotice';
import { sanitizeHeaderValue } from './utils/headers';

// Runtime-only modules provided by n8n's VM context — not available at compile time.
declare function require(module: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any

const PAYI_DEBUG_LOG = path.join(process.env.HOME || '/tmp', '.n8n', 'payi-databricks-debug.log');
const PAYI_FILE_DEBUG_ENABLED = process.env.PAYI_FILE_DEBUG === '1';

// Mask sensitive keys before they hit disk. payiLog dumps full request/response
// JSON which includes credential headers — without this, Pay-i and provider keys
// land in plaintext in payi-databricks-debug.log.
const SENSITIVE_KEYS = ['xProxy-Api-Key', 'Authorization', 'apiKey', 'api_key', 'openai_api_key'];
const SECRET_PATTERNS: ReadonlyArray<RegExp> = SENSITIVE_KEYS.map(
	(k) => new RegExp(`("${k}"\\s*:\\s*")([^"]+)(")`, 'gi'),
);
function redactSecrets(s: string): string {
	let out = s;
	for (const re of SECRET_PATTERNS) {
		out = out.replace(re, (_m, p1, _val, p3) => `${p1}***REDACTED***${p3}`);
	}
	return out;
}

function payiLog(msg: string) {
	if (!PAYI_FILE_DEBUG_ENABLED) return;
	const line = `[${new Date().toISOString()}] ${redactSecrets(msg)}\n`;
	fs.appendFileSync(PAYI_DEBUG_LOG, line);
}

function deriveProviderBaseUri(workspaceUrl: string): string {
	const url = new URL(workspaceUrl);
	return `${url.protocol}//${url.host}/serving-endpoints`;
}

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
			...createTrackingFields('databricks', 'endpointName', 'Pay-i Databricks (Proxy)'),
			...versionNotice,
		],
	};

	methods = {
		listSearch: {
			async getServingEndpoints(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const credentials = await this.getCredentials('payiDatabricksApi');
				const host = (credentials.workspaceUrl as string).replace(/\/+$/, '');
				const token = credentials.accessToken as string;

				const response = await this.helpers.httpRequest({
					method: 'GET',
					url: `${host}/api/2.0/serving-endpoints`,
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: 'application/json',
					},
					json: true,
				}) as { endpoints?: Array<{ name: string; config?: { served_entities?: Array<{ external_model?: { name?: string }; foundation_model?: { name?: string } }> } }> };

				const endpoints = response.endpoints ?? [];

				const allResults = endpoints.map((endpoint) => {
					const modelNames = (endpoint.config?.served_entities || [])
						.map((entity) => entity.external_model?.name || entity.foundation_model?.name)
						.filter(Boolean)
						.join(', ');

					return {
						name: endpoint.name,
						value: endpoint.name,
						description: modelNames || undefined,
					};
				}).sort((a, b) => a.name.localeCompare(b.name));

				if (filter) {
					const filterLower = filter.toLowerCase();
					return {
						results: allResults.filter((r) =>
							r.name.toLowerCase().includes(filterLower) ||
							(r.description && r.description.toLowerCase().includes(filterLower)),
						),
					};
				}

				return { results: allResults };
			},

			async getDeployedModels(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
				const payiCredentials = await this.getCredentials('payiApi');
				const payiBaseUrl = (payiCredentials.baseUrl as string).replace(/\/+$/, '');
				const payiApiKey = payiCredentials.apiKey as string;

				const cloudProvider = this.getNodeParameter('cloudProvider', '') as string;
				const category = `system.databricks.${cloudProvider}`;

				let response: { items?: Array<{ resource: string }> };
				try {
					response = await this.helpers.httpRequest({
						method: 'GET',
						url: `${payiBaseUrl}/api/v1/categories/${encodeURIComponent(category)}/resources`,
						headers: {
							'xProxy-api-key': payiApiKey,
							Accept: 'application/json',
						},
						json: true,
					});
				} catch {
					throw new Error(
						'Could not retrieve deployed models from Pay-i. Please check your configured Pay-i credentials.',
					);
				}

				const items = response.items ?? [];

				const allResults = items
					.map((item) => ({
						name: item.resource,
						value: item.resource,
					}))
					.sort((a, b) => a.name.localeCompare(b.name));

				if (filter) {
					const filterLower = filter.toLowerCase();
					return {
						results: allResults.filter((r) => r.name.toLowerCase().includes(filterLower)),
					};
				}

				return { results: allResults };
			},
		},
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		payiLog(`supplyData called for item ${itemIndex}`);

		const { ChatOpenAI } = require('@langchain/openai');
		const { N8nLlmTracing, makeN8nLlmFailedAttemptHandler } = require('@n8n/ai-utilities');

		const payiCredentials = await this.getCredentials('payiApi');
		const payiBaseUrl = (payiCredentials.baseUrl as string).replace(/\/+$/, '');
		const payiApiKey = payiCredentials.apiKey as string;

		const databricksCredentials = await this.getCredentials('payiDatabricksApi');
		const accessToken = databricksCredentials.accessToken as string;
		const workspaceUrl = (databricksCredentials.workspaceUrl as string).replace(/\/+$/, '');

		const endpointName = this.getNodeParameter('endpointName', itemIndex, '', { extractValue: true }) as string;
		const deployedModel = this.getNodeParameter('deployedModel', itemIndex, '', { extractValue: true }) as string;
		const cloudProvider = this.getNodeParameter('cloudProvider', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as Record<string, unknown>;

		if (!deployedModel && !endpointName.startsWith('databricks-')) {
			throw new Error(
				'Deployed Model is required for custom serving endpoints (those not starting with "databricks-").',
			);
		}

		// Build tracking headers
		const trackingHeaders: Record<string, string> = {};
		const userId = this.getNodeParameter('userId', itemIndex, '') as string;
		const useCaseName = this.getNodeParameter('useCaseName', itemIndex, '') as string;
		const useCaseId = this.getNodeParameter('useCaseId', itemIndex, '') as string;
		const advancedTracking = this.getNodeParameter('advancedTracking', itemIndex, {}) as Record<string, string>;
		const useCaseVersion = advancedTracking.useCaseVersion || '';
		// Canvas display name (e.g. "Pay-i DBX #4 - Summarizer") is more useful in
		// Pay-i's dashboard than the generic node-type label. If the user hasn't
		// changed the parameter from its hard-coded default, swap in the canvas name.
		let useCaseStep = this.getNodeParameter('useCaseStep', itemIndex, '') as string;
		if (!useCaseStep || useCaseStep === 'Pay-i Databricks (Proxy)') {
			useCaseStep = this.getNode().name;
		}
		const useCaseProperties = advancedTracking.useCaseProperties || '';
		const limitIds = advancedTracking.limitIds || '';
		const debugLogging = !!(advancedTracking as Record<string, unknown>).debugLogging;
		const flattenContent = (advancedTracking as Record<string, unknown>).flattenContent !== false;

		// Header values must be ASCII; canvas names / workflow names may include
		// em-dashes, interpuncts, smart quotes etc. that crash node fetch or
		// produce opaque 400s upstream. Sanitize every xProxy-* value at the source.
		if (userId) trackingHeaders['xProxy-User-ID'] = sanitizeHeaderValue(userId);
		if (useCaseName) trackingHeaders['xProxy-UseCase-Name'] = sanitizeHeaderValue(useCaseName);
		if (useCaseId) trackingHeaders['xProxy-UseCase-ID'] = sanitizeHeaderValue(useCaseId);
		if (useCaseVersion) trackingHeaders['xProxy-UseCase-Version'] = sanitizeHeaderValue(useCaseVersion);
		if (useCaseStep) trackingHeaders['xProxy-UseCase-Step'] = sanitizeHeaderValue(useCaseStep);
		if (useCaseProperties) {
			trackingHeaders['xProxy-UseCase-Properties'] = sanitizeHeaderValue(useCaseProperties);
		}
		if (limitIds) trackingHeaders['xProxy-Limit-IDs'] = sanitizeHeaderValue(limitIds);

		const providerBaseUri = deriveProviderBaseUri(workspaceUrl);

		const defaultHeaders: Record<string, string> = {
			'xProxy-Api-Key': payiApiKey,
			'xProxy-Provider-BaseUri': providerBaseUri,
			'xProxy-PriceAs-Category': `system.databricks.${cloudProvider}`,
			...trackingHeaders,
		};
		if (deployedModel) {
			defaultHeaders['xProxy-PriceAs-Resource'] = deployedModel;
		}

		if (debugLogging) {
			const mask = (v: string) => v.length <= 8 ? '****' : v.substring(0, 8) + '****';
			this.logger.info(`[Pay-i Databricks] ──── DEBUG (item ${itemIndex}) ────`);
			this.logger.info(`[Pay-i Databricks] workspaceUrl="${workspaceUrl}"`);
			this.logger.info(`[Pay-i Databricks] → providerBaseUri="${providerBaseUri}"`);
			this.logger.info(`[Pay-i Databricks] endpoint="${endpointName}" cloud="${cloudProvider}"`);
			this.logger.info(`[Pay-i Databricks] baseURL="${payiBaseUrl}/api/v1/proxy/openai/v1"`);
			const masked = Object.fromEntries(
				Object.entries(defaultHeaders).map(([k, v]) =>
					['xProxy-Api-Key', 'Authorization'].includes(k) ? [k, mask(v)] : [k, v],
				),
			);
			this.logger.info(`[Pay-i Databricks] Headers: ${JSON.stringify(masked, null, 2)}`);
		}

		const model = new ChatOpenAI({
			apiKey: accessToken,
			model: endpointName,
			...options,
			configuration: {
				baseURL: `${payiBaseUrl}/api/v1/proxy/openai/v1`,
				defaultHeaders,
			},
			callbacks: [new N8nLlmTracing(this)],
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this),
		});

		payiLog(`Model configured: baseURL=${payiBaseUrl}/api/v1/proxy/openai/v1, model=${endpointName}`);
		payiLog(`Options: ${JSON.stringify(options)}`);

		// Patch completionWithRetry to normalize structured content and optionally log.
		// In @langchain/openai@1.x, ChatOpenAI delegates _generate() to either
		// `model.completions` (Chat Completions API) or `model.responses` (Responses API).
		// completionWithRetry lives on those sub-objects, not on the model itself.
		const logger = debugLogging ? this.logger : null;
		const patchCompletionWithRetry = (target: any, label: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
			if (!target || typeof target.completionWithRetry !== 'function') return;
			const orig = target.completionWithRetry.bind(target);
			target.completionWithRetry = async function(request: any, opts?: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
				payiLog(`──── RAW REQUEST TO OPENAI SDK (${label}) ────`);
				payiLog(`Request params: ${JSON.stringify(request).substring(0, 5000)}`);
				try {
					const result = await orig(request, opts);
					// Flatten structured content blocks to a plain string.
					// Some models (e.g. Gemini/Claude via Databricks) return content as
					// [{type:"text", text:"...", ...}] which is non-standard for the
					// OpenAI chat completion contract. LangChain expects a string.
					if (flattenContent && result?.choices) {
						for (const choice of result.choices) {
							if (Array.isArray(choice?.message?.content)) {
								choice.message.content = choice.message.content
									.filter((block: any) => block.type === 'text') // eslint-disable-line @typescript-eslint/no-explicit-any
									.map((block: any) => block.text) // eslint-disable-line @typescript-eslint/no-explicit-any
									.join('');
							}
						}
					}
					payiLog(`──── RAW RESPONSE FROM OPENAI SDK (${label}) ────`);
					payiLog(`Result: ${JSON.stringify(result).substring(0, 5000)}`);
					if (logger) {
						logger.info(`[Pay-i Databricks] Result: ${JSON.stringify(result).substring(0, 3000)}`);
					}
					return result;
				} catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
					payiLog(`──── ERROR FROM OPENAI SDK (${label}) ────`);
					payiLog(`Error: ${err.message || err}`);
					payiLog(`Status: ${err.status || err.statusCode || 'unknown'}`);
					payiLog(`Full error: ${JSON.stringify(err, Object.getOwnPropertyNames(err)).substring(0, 5000)}`);
					if (logger) {
						logger.info(`[Pay-i Databricks] Error: ${err.message || err}`);
						logger.info(`[Pay-i Databricks] Status: ${err.status || err.statusCode || 'unknown'}`);
					}
					throw err;
				}
			};
		};
		patchCompletionWithRetry((model as any).completions, 'completions'); // eslint-disable-line @typescript-eslint/no-explicit-any
		patchCompletionWithRetry((model as any).responses, 'responses'); // eslint-disable-line @typescript-eslint/no-explicit-any

		return {
			response: model,
		};
	}
}
