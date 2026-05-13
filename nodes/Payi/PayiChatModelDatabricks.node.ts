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

// Runtime-only modules provided by n8n's VM context — not available at compile time.
declare function require(module: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any

const PAYI_DEBUG_LOG = path.join(process.env.HOME || '/tmp', '.n8n', 'payi-databricks-debug.log');
const PAYI_FILE_DEBUG_ENABLED = process.env.PAYI_FILE_DEBUG === '1';
function payiLog(msg: string) {
	if (!PAYI_FILE_DEBUG_ENABLED) return;
	const line = `[${new Date().toISOString()}] ${msg}\n`;
	fs.appendFileSync(PAYI_DEBUG_LOG, line);
}

function deriveProviderBaseUri(workspaceUrl: string): string {
	const url = new URL(workspaceUrl);
	return `${url.protocol}//${url.host}`;
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
			...createTrackingFields('databricks', 'endpointName'),
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
		const deployedModel = this.getNodeParameter('deployedModel', itemIndex, '') as string;
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

		// Pass redacted headers for serialization (visible in n8n trace UI),
		// then replace with real headers on the live client config.
		const redactedHeaders: Record<string, string> = { ...defaultHeaders };
		if (redactedHeaders['xProxy-Api-Key']) {
			redactedHeaders['xProxy-Api-Key'] = '***';
		}

		const model = new ChatOpenAI({
			apiKey: accessToken,
			model: endpointName,
			...options,
			configuration: {
				baseURL: `${payiBaseUrl}/api/v1/proxy/openai/v1`,
				defaultHeaders: redactedHeaders,
			},
			callbacks: [new N8nLlmTracing(this)],
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this),
		});

		// Replace redacted headers with real ones on the live client config
		(model as any).clientConfig.defaultHeaders = defaultHeaders; // eslint-disable-line @typescript-eslint/no-explicit-any

		payiLog(`Model configured: baseURL=${payiBaseUrl}/api/v1/proxy/openai/v1, model=${endpointName}`);
		payiLog(`Options: ${JSON.stringify(options)}`);

		// Patch completionWithRetry to capture raw request/response
		const origCompletionWithRetry = (model as any).completionWithRetry.bind(model); // eslint-disable-line @typescript-eslint/no-explicit-any
		(model as any).completionWithRetry = async function(request: any, opts?: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
			payiLog(`──── RAW REQUEST TO OPENAI SDK ────`);
			payiLog(`Request params: ${JSON.stringify(request).substring(0, 5000)}`);
			payiLog(`ClientConfig baseURL: ${(model as any).clientConfig?.baseURL || 'not set'}`); // eslint-disable-line @typescript-eslint/no-explicit-any
			payiLog(`ClientConfig defaultHeaders: ${JSON.stringify((model as any).clientConfig?.defaultHeaders || {})}`); // eslint-disable-line @typescript-eslint/no-explicit-any
			try {
				const result = await origCompletionWithRetry(request, opts);
				// Normalize structured content blocks to a plain string.
				// Some models (e.g. Claude via Databricks) return content as an array
				// of objects [{type:"text", text:"..."}] which LangChain doesn't handle.
				// if (result?.choices) {
				// 	for (const choice of result.choices) {
				// 		if (Array.isArray(choice?.message?.content)) {
				// 			choice.message.content = choice.message.content
				// 				.filter((block: any) => block.type === 'text') // eslint-disable-line @typescript-eslint/no-explicit-any
				// 				.map((block: any) => block.text) // eslint-disable-line @typescript-eslint/no-explicit-any
				// 				.join('');
				// 		}
				// 	}
				// }
				payiLog(`──── RAW RESPONSE FROM OPENAI SDK ────`);
				payiLog(`Result: ${JSON.stringify(result).substring(0, 5000)}`);
				return result;
			} catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
				payiLog(`──── ERROR FROM OPENAI SDK ────`);
				payiLog(`Error: ${err.message || err}`);
				payiLog(`Status: ${err.status || err.statusCode || 'unknown'}`);
				payiLog(`Headers: ${JSON.stringify(err.headers || err.responseHeaders || {})}`);
				payiLog(`Body: ${err.body || err.responseBody || ''}`);
				payiLog(`Error object keys: ${Object.keys(err).join(', ')}`);
				payiLog(`Full error: ${JSON.stringify(err, Object.getOwnPropertyNames(err)).substring(0, 5000)}`);
				throw err;
			}
		};

		return {
			response: model,
		};
	}
}
