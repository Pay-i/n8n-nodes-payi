import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	providerFields,
	trackingFields,
	outputFields,
} from './descriptions';
import { buildProviderRequest } from './providers';

function maskValue(value: string): string {
	if (value.length <= 8) return '****';
	return value.substring(0, 8) + '****';
}

function maskHeaders(headers: Record<string, string>): Record<string, string> {
	const sensitiveKeys = [
		'authorization', 'x-api-key', 'api-key', 'xproxy-api-key',
		'x-amz-access-key-id', 'x-amz-secret-access-key', 'x-amz-session-token',
	];
	const masked: Record<string, string> = {};
	for (const [key, val] of Object.entries(headers)) {
		if (sensitiveKeys.includes(key.toLowerCase()) || key.toLowerCase().startsWith('bearer')) {
			masked[key] = maskValue(val);
		} else {
			masked[key] = val;
		}
	}
	return masked;
}

function sanitizeHeaderValue(value: string): string {
	return value.replace(/[\r\n\0]/g, '');
}

function safeJsonParse(value: string, fieldName: string, itemIndex: number, node: IExecuteFunctions): unknown {
	try {
		return JSON.parse(value);
	} catch {
		throw new NodeOperationError(node.getNode(), `"${fieldName}" contains invalid JSON`, {
			itemIndex,
		});
	}
}

function redactBody(body: object): string {
	const keys = Object.keys(body);
	const summary: Record<string, string> = {};
	for (const key of keys) {
		const val = (body as Record<string, unknown>)[key];
		if (typeof val === 'string') {
			summary[key] = val.length > 50 ? val.substring(0, 50) + '...' : val;
		} else if (Array.isArray(val)) {
			summary[key] = `[Array(${val.length})]`;
		} else if (typeof val === 'object' && val !== null) {
			summary[key] = `{Object(${Object.keys(val).length} keys)}`;
		} else {
			summary[key] = String(val);
		}
	}
	return JSON.stringify(summary, null, 2);
}

export class Payi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pay-i Proxy',
		name: 'payi',
		icon: 'file:payi.png',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["provider"]}} — {{$parameter["model"]}}',
		description: 'Send LLM requests through Pay-i proxy for cost tracking and budget enforcement',
		defaults: {
			name: 'Pay-i Proxy',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'payiApi',
				required: true,
			},
		],
		properties: [
			...providerFields,
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'json',
				default: '[{"role": "user", "content": "Hello!"}]',
				required: true,
				description: 'The messages to send to the model as a JSON array',
			},
			{
				displayName: 'Raw Request Body Override',
				name: 'rawBody',
				type: 'json',
				default: '',
				description:
					'When set, this JSON body is sent directly to the API, bypassing all structured fields above',
			},
			...trackingFields,
			...outputFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('payiApi');
		const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

		// Validate baseUrl — enforce HTTPS to prevent SSRF
		if (!baseUrl.startsWith('https://')) {
			throw new NodeOperationError(this.getNode(), 'Pay-i Base URL must start with https://');
		}

		for (let i = 0; i < items.length; i++) {
			try {
				const includeCostData = this.getNodeParameter('includeCostData', i) as boolean;
				const returnFullResponse = this.getNodeParameter('returnFullResponse', i) as boolean;
				const debugLogging = this.getNodeParameter('debugLogging', i, false) as boolean;
				const rawBody = this.getNodeParameter('rawBody', i, '') as string;
				const messagesJson = this.getNodeParameter('messages', i) as string;

				// Build provider-specific request
				const providerRequest = await buildProviderRequest(this, i);

				// Merge messages into body
				if (rawBody) {
					providerRequest.body = safeJsonParse(rawBody, 'Raw Request Body Override', i, this) as object;
				} else {
					const messages = safeJsonParse(messagesJson, 'Messages', i, this) as object[];
					const body = providerRequest.body as Record<string, unknown>;
					body.messages = messages;
					providerRequest.body = body;
				}

				// Build tracking headers (sanitized against header injection)
				const correlationId = this.getNodeParameter('correlationId', i, '') as string;
				const userId = this.getNodeParameter('userId', i, '') as string;
				const useCaseName = this.getNodeParameter('useCaseName', i, '') as string;
				const useCaseId = this.getNodeParameter('useCaseId', i, '') as string;
				const useCaseVersion = this.getNodeParameter('useCaseVersion', i, '') as string;
				const useCaseStep = this.getNodeParameter('useCaseStep', i, '') as string;
				const useCaseProperties = this.getNodeParameter('useCaseProperties', i, '') as string;
				const limitIds = this.getNodeParameter('limitIds', i, '') as string;

				const trackingHeaders: Record<string, string> = {};
				if (userId) trackingHeaders['xProxy-User-ID'] = sanitizeHeaderValue(userId);
				if (useCaseName) trackingHeaders['xProxy-UseCase-Name'] = sanitizeHeaderValue(useCaseName);
				if (useCaseId) trackingHeaders['xProxy-UseCase-ID'] = sanitizeHeaderValue(useCaseId);
				if (useCaseVersion) trackingHeaders['xProxy-UseCase-Version'] = sanitizeHeaderValue(useCaseVersion);
				if (useCaseStep) trackingHeaders['xProxy-UseCase-Step'] = sanitizeHeaderValue(useCaseStep);
				if (useCaseProperties) {
					const props = safeJsonParse(useCaseProperties, 'xProxy-UseCase-Properties', i, this);
					trackingHeaders['xProxy-UseCase-Properties'] = JSON.stringify(props);
				}
				if (limitIds) trackingHeaders['xProxy-Limit-IDs'] = sanitizeHeaderValue(limitIds);

				if (correlationId)
					trackingHeaders['xProxy-Request-Tags'] = sanitizeHeaderValue(correlationId);

				const headers: Record<string, string> = {
					'Content-Type': 'application/json',
					...providerRequest.headers,
					...trackingHeaders,
				};

				const url = `${baseUrl}/api/v1/proxy/${providerRequest.urlPath}`;

				const requestOptions = {
					method: providerRequest.method as 'POST' | 'GET',
					url,
					headers,
					body: providerRequest.body,
					json: true,
					returnFullResponse,
				};

				if (debugLogging) {
					this.logger.info(`[Pay-i] ──── REQUEST (item ${i}) ────`);
					this.logger.info(`[Pay-i] ${requestOptions.method} ${url}`);
					this.logger.info(`[Pay-i] Headers: ${JSON.stringify(maskHeaders(headers), null, 2)}`);
					this.logger.info(`[Pay-i] Body shape: ${redactBody(providerRequest.body as object)}`);
				}

				let response: unknown;
				try {
					response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'payiApi',
						requestOptions,
					);
				} catch (reqError) {
					if (debugLogging) {
						const errMsg = reqError instanceof Error ? reqError.message : String(reqError);
						this.logger.error(`[Pay-i] ──── ERROR (item ${i}) ────`);
						this.logger.error(`[Pay-i] ${errMsg}`);
					}
					throw reqError;
				}

				if (debugLogging) {
					this.logger.info(`[Pay-i] ──── RESPONSE (item ${i}) ────`);
					const preview = JSON.stringify(response);
					this.logger.info(`[Pay-i] ${preview.length > 2000 ? preview.substring(0, 2000) + '...(truncated)' : preview}`);
				}

				const outputData = response as IDataObject;

				if (includeCostData && outputData.xproxy_result !== undefined) {
					outputData.payiCost = outputData.xproxy_result;
					delete outputData.xproxy_result;
				} else {
					delete outputData.xproxy_result;
				}

				returnData.push({ json: outputData });
			} catch (error) {
				if (this.continueOnFail()) {
					const errorMessage =
						error instanceof Error ? error.message : 'An unknown error occurred';
					returnData.push({
						json: { error: errorMessage },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}
