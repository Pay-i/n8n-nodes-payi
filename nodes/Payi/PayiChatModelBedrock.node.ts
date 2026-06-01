 
import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { chatModelBedrockFields } from './descriptions/chatModelBedrockFields';
import { createTrackingFields } from './descriptions/trackingFields';
import { versionNotice } from './descriptions/versionNotice';
import { sanitizeHeaderValue } from './utils/headers';

// Runtime-only modules provided by n8n's VM context — not available at compile time.
// Declared here so TypeScript accepts the require() calls.
declare function require(module: string): any; // eslint-disable-line @typescript-eslint/no-explicit-any

export class PayiChatModelBedrock implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pay-i Amazon Bedrock (Proxy)',
		name: 'lmChatPayiBedrock',
		icon: 'file:payi_logo.png',
		group: ['transform'],
		version: [1],
		description:
			'Amazon Bedrock chat model routed through Pay-i proxy for cost tracking and budget enforcement',
		defaults: {
			name: 'Pay-i Amazon Bedrock (Proxy)',
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
				name: 'aws',
				required: true,
			},
		],
		properties: [
			...chatModelBedrockFields,
			...createTrackingFields('bedrock', 'model', 'Pay-i Amazon Bedrock (Proxy)'),
			...versionNotice,
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		// Runtime imports — resolved through n8n's VM context, not bundled
		const { ChatBedrockConverse } = require('@langchain/aws');
		const { N8nLlmTracing, makeN8nLlmFailedAttemptHandler } = require('@n8n/ai-utilities');

		const payiCredentials = await this.getCredentials('payiApi');
		const payiBaseUrl = (payiCredentials.baseUrl as string).replace(/\/+$/, '');
		const payiApiKey = payiCredentials.apiKey as string;

		const awsCredentialsRaw = await this.getCredentials('aws');
		const awsAccessKeyId = awsCredentialsRaw.accessKeyId as string;
		const awsSecretAccessKey = awsCredentialsRaw.secretAccessKey as string;
		const awsSessionToken = (awsCredentialsRaw.sessionToken as string) || '';

		const modelId = this.getNodeParameter('model', itemIndex) as string;
		const region = this.getNodeParameter('region', itemIndex, (awsCredentialsRaw.region as string) || 'us-east-1') as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as Record<string, unknown>;

		// Build tracking headers
		const trackingHeaders: Record<string, string> = {};
		const userId = this.getNodeParameter('userId', itemIndex, '') as string;
		const useCaseName = this.getNodeParameter('useCaseName', itemIndex, '') as string;
		const useCaseId = this.getNodeParameter('useCaseId', itemIndex, '') as string;
		// Advanced tracking fields (collapsed in UI under "Advanced Tracking")
		const advancedTracking = this.getNodeParameter('advancedTracking', itemIndex, {}) as Record<string, string>;
		const useCaseVersion = advancedTracking.useCaseVersion || '';
		// Canvas display name (e.g. "Pay-i Bedrock #4 - Summarizer") is more useful in
		// Pay-i's dashboard than the generic node-type label. If the user hasn't
		// changed the parameter from its hard-coded default, swap in the canvas name.
		let useCaseStep = this.getNodeParameter('useCaseStep', itemIndex, '') as string;
		if (!useCaseStep || useCaseStep === 'Pay-i Amazon Bedrock (Proxy)') {
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

		// Build AWS credentials
		const awsCredentials: Record<string, string> = {
			accessKeyId: awsAccessKeyId,
			secretAccessKey: awsSecretAccessKey,
		};
		if (awsSessionToken) {
			awsCredentials.sessionToken = awsSessionToken;
		}

		// Route through Pay-i Bedrock proxy
		// The proxy URL replaces the Bedrock endpoint host
		const proxyHost = `${payiBaseUrl}/api/v1/proxy/aws.bedrock`.replace(/^https?:\/\//, '');
		const additionalHeaders: Record<string, string> = {
			'xProxy-Api-Key': payiApiKey,
			'xProxy-PriceAs-Resource': modelId,
			...trackingHeaders,
		};

		if (debugLogging) {
			const mask = (v: string) => v.length <= 8 ? '****' : v.substring(0, 8) + '****';
			this.logger.info(`[Pay-i Bedrock] ──── DEBUG (item ${itemIndex}) ────`);
			this.logger.info(`[Pay-i Bedrock] model="${modelId}" region="${region}" proxyHost="${proxyHost}"`);
			const masked = Object.fromEntries(
				Object.entries(additionalHeaders).map(([k, v]) =>
					k === 'xProxy-Api-Key' ? [k, mask(v)] : [k, v],
				),
			);
			this.logger.info(`[Pay-i Bedrock] Headers: ${JSON.stringify(masked, null, 2)}`);
		}

		const model = new ChatBedrockConverse({
			model: modelId,
			region,
			credentials: awsCredentials,
			endpointHost: proxyHost,
			temperature: options.temperature as number | undefined,
			maxTokens: options.maxTokens as number | undefined,
			topP: options.topP as number | undefined,
			additionalHeaders,
			callbacks: [new N8nLlmTracing(this)],
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this),
		});

		return {
			response: model,
		};
	}
}
