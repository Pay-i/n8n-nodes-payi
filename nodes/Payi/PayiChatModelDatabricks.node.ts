/* eslint-disable @typescript-eslint/no-var-requires */
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

/**
 * Derive the Databricks AI Gateway URL from a workspace URL.
 *
 * Examples:
 *   https://1234567890.cloud.databricks.com  →  https://1234567890.ai-gateway.cloud.databricks.com/mlflow
 *   https://adb-1234567890.azuredatabricks.net  →  https://adb-1234567890.ai-gateway.azuredatabricks.net/mlflow
 */
function deriveGatewayUrl(workspaceUrl: string): string {
	const trimmed = workspaceUrl.replace(/\/+$/, '');
	return (
		trimmed.replace(
			/^(https:\/\/[^.]+)\.(cloud\.databricks\.com|azuredatabricks\.net)/,
			'$1.ai-gateway.$2',
		) + '/mlflow'
	);
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
				name: 'databricks',
				required: true,
			},
		],
		properties: [
			...chatModelDatabricksFields,
			...createTrackingFields('databricks', 'endpointName'),
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		// Runtime imports — resolved through n8n's VM context, not bundled
		// We use ChatOpenAI because Databricks Model Serving exposes an
		// OpenAI-compatible chat/completions endpoint.
		const { ChatOpenAI } = require('@langchain/openai');
		const { N8nLlmTracing, makeN8nLlmFailedAttemptHandler } = require('@n8n/ai-utilities');

		const payiCredentials = await this.getCredentials('payiApi');
		const payiBaseUrl = (payiCredentials.baseUrl as string).replace(/\/+$/, '');
		const payiApiKey = payiCredentials.apiKey as string;

		// Native Databricks credential type (from n8n-nodes-databricks) uses 'host' and 'token'
		const databricksCredentials = await this.getCredentials('databricks');
		const accessToken = databricksCredentials.token as string;
		const workspaceUrl = (databricksCredentials.host as string).replace(/\/+$/, '');

		const endpointName = this.getNodeParameter('endpointName', itemIndex) as string;
		const cloudProvider = this.getNodeParameter('cloudProvider', itemIndex) as string;
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

		// Derive the AI Gateway URL from the workspace URL
		const gatewayUrl = deriveGatewayUrl(workspaceUrl);

		// Route through Pay-i's OpenAI proxy path (Databricks is OpenAI-compatible)
		const baseURL = `${payiBaseUrl}/api/v1/proxy/openai/v1`;

		const defaultHeaders: Record<string, string> = {
			'xProxy-Api-Key': payiApiKey,
			'xProxy-Provider-BaseUri': gatewayUrl,
			'xProxy-PriceAs-Category': `system.databricks.${cloudProvider}`,
			Authorization: `Bearer ${accessToken}`,
			...trackingHeaders,
		};

		if (debugLogging) {
			const mask = (v: string) => v.length <= 8 ? '****' : v.substring(0, 8) + '****';
			this.logger.info(`[Pay-i Databricks] ──── DEBUG (item ${itemIndex}) ────`);
			this.logger.info(`[Pay-i Databricks] workspaceUrl="${workspaceUrl}"`);
			this.logger.info(`[Pay-i Databricks] → gatewayUrl="${gatewayUrl}"`);
			this.logger.info(`[Pay-i Databricks] endpoint="${endpointName}" cloud="${cloudProvider}"`);
			this.logger.info(`[Pay-i Databricks] baseURL="${baseURL}"`);
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
