 
import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { chatModelAzureFields } from './descriptions/chatModelAzureFields';
import { createTrackingFields } from './descriptions/trackingFields';
import { versionNotice } from './descriptions/versionNotice';
import { sanitizeHeaderValue } from './utils/headers';

// Runtime-only modules provided by n8n's VM context — not available at compile time.
// Declared here so TypeScript accepts the require() calls.
declare function require(module: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any

export class PayiChatModelAzure implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pay-i Azure AI Foundry (Proxy)',
		name: 'lmChatPayiAzure',
		icon: 'file:payi_logo.png',
		group: ['transform'],
		version: [1],
		description:
			'Azure AI Foundry chat model routed through Pay-i proxy for cost tracking and budget enforcement',
		defaults: {
			name: 'Pay-i Azure AI Foundry (Proxy)',
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
				name: 'azureOpenAiApi',
				required: true,
			},
		],
		properties: [
			...chatModelAzureFields,
			...createTrackingFields('azure', 'deploymentName', 'Pay-i Azure AI Foundry (Proxy)'),
			...versionNotice,
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		// Runtime imports — resolved through n8n's VM context, not bundled
		// We use ChatOpenAI (not AzureChatOpenAI) because:
		//   1. Azure OpenAI's wire format is identical to OpenAI (same JSON schema)
		//   2. ChatOpenAI lets us set baseURL/headers directly via configuration
		//   3. AzureChatOpenAI's internal auth handling (double header injection,
		//      request-time overrides) conflicts with Pay-i's proxy auth flow
		const { ChatOpenAI } = require('@langchain/openai');
		const { N8nLlmTracing, makeN8nLlmFailedAttemptHandler } = require('@n8n/ai-utilities');

		const payiCredentials = await this.getCredentials('payiApi');
		const payiBaseUrl = (payiCredentials.baseUrl as string).replace(/\/+$/, '');
		const payiApiKey = payiCredentials.apiKey as string;

		const providerCredentials = await this.getCredentials('azureOpenAiApi');
		const providerApiKey = providerCredentials.apiKey as string;
		// Build the upstream Azure endpoint URL for Pay-i proxy routing.
		// The credential may have an explicit endpoint, otherwise construct from resourceName.
		const azureResourceName = providerCredentials.resourceName as string;
		const azureEndpointRaw = (providerCredentials.endpoint as string) || '';
		const azureEndpoint = azureEndpointRaw
			? azureEndpointRaw.replace(/\/+$/, '')
			: `https://${azureResourceName}.openai.azure.com`;

		const deploymentName = this.getNodeParameter('deploymentName', itemIndex) as string;
		const nodeApiVersion = this.getNodeParameter('apiVersion', itemIndex, '') as string;
		// Prefer the node parameter if explicitly set; fall back to the credential's apiVersion
		const credApiVersion = (providerCredentials.apiVersion as string) || '';
		const apiVersion = nodeApiVersion || credApiVersion || '2024-08-01-preview';
		const options = this.getNodeParameter('options', itemIndex, {}) as Record<string, unknown>;

		// Build tracking headers
		const trackingHeaders: Record<string, string> = {};
		const userId = this.getNodeParameter('userId', itemIndex, '') as string;
		const useCaseName = this.getNodeParameter('useCaseName', itemIndex, '') as string;
		const useCaseId = this.getNodeParameter('useCaseId', itemIndex, '') as string;
		// Advanced tracking fields (collapsed in UI under "Advanced Tracking")
		const advancedTracking = this.getNodeParameter('advancedTracking', itemIndex, {}) as Record<string, string>;
		const useCaseVersion = advancedTracking.useCaseVersion || '';
		// Canvas display name (e.g. "Pay-i Azure #4 - Summarizer") is more useful in
		// Pay-i's dashboard than the generic node-type label. If the user hasn't
		// changed the parameter from its hard-coded default, swap in the canvas name.
		let useCaseStep = this.getNodeParameter('useCaseStep', itemIndex, '') as string;
		if (!useCaseStep || useCaseStep === 'Pay-i Azure AI Foundry (Proxy)') {
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

		// Construct the Azure-style URL through Pay-i's proxy.
		// Azure OpenAI uses: {endpoint}/openai/deployments/{name}/chat/completions?api-version={v}
		// Pay-i proxy prefix: {payiBaseUrl}/api/v1/proxy/azure.openai
		// ChatOpenAI appends /chat/completions to baseURL, so we set baseURL up to the deployment:
		const baseURL = `${payiBaseUrl}/api/v1/proxy/azure.openai/openai/deployments/${deploymentName}`;

		const defaultHeaders: Record<string, string> = {
			'xProxy-Api-Key': payiApiKey,
			'xProxy-Provider-BaseUri': azureEndpoint,
			'xProxy-PriceAs-Resource': deploymentName,
			'api-key': providerApiKey,
			...trackingHeaders,
		};

		if (debugLogging) {
			const mask = (v: string) => v.length <= 8 ? '****' : v.substring(0, 8) + '****';
			this.logger.info(`[Pay-i Azure] ──── DEBUG (item ${itemIndex}) ────`);
			this.logger.info(`[Pay-i Azure] Credential keys: ${Object.keys(providerCredentials).join(', ')}`);
			this.logger.info(`[Pay-i Azure] resourceName="${azureResourceName}" endpointRaw="${azureEndpointRaw}"`);
			this.logger.info(`[Pay-i Azure] → azureEndpoint="${azureEndpoint}"`);
			this.logger.info(`[Pay-i Azure] deployment="${deploymentName}" apiVersion="${apiVersion}"`);
			this.logger.info(`[Pay-i Azure] baseURL="${baseURL}"`);
			const masked = Object.fromEntries(
				Object.entries(defaultHeaders).map(([k, v]) =>
					['xProxy-Api-Key', 'api-key'].includes(k) ? [k, mask(v)] : [k, v],
				),
			);
			this.logger.info(`[Pay-i Azure] Headers: ${JSON.stringify(masked, null, 2)}`);
		}

		const model = new ChatOpenAI({
			apiKey: providerApiKey,
			model: deploymentName,
			...options,
			timeout,
			maxRetries: (options.maxRetries as number) ?? 2,
			configuration: {
				baseURL,
				defaultHeaders,
				defaultQuery: {
					'api-version': apiVersion,
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
