import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { createTrackingFields } from './descriptions/trackingFields';
import { outputFields } from './descriptions/outputFields';

interface OpenAPISchema {
	servers?: Array<{ url: string }>;
	paths: {
		[path: string]: {
			post?: {
				requestBody?: {
					content?: {
						'application/json'?: {
							schema?: {
								oneOf?: Array<{ type: string; properties: Record<string, unknown> }>;
								properties?: Record<string, unknown>;
							};
						};
					};
				};
			};
		};
	};
}

type DetectFormatResult = {
	format: string;
	schema: unknown;
	requiredFields: string[];
	invocationUrl: string;
};

function detectFormatFromProperties(
	properties: Record<string, unknown>,
	invocationUrl: string,
	isOneOf = false,
): DetectFormatResult | null {
	if (properties.messages)
		return { format: 'chat', schema: properties.messages, requiredFields: ['messages'], invocationUrl };
	if (properties.prompt)
		return { format: 'completions', schema: properties.prompt, requiredFields: ['prompt'], invocationUrl };
	if (properties.input && (!isOneOf || (!properties.dataframe_records && !properties.dataframe_split)))
		return { format: 'embeddings', schema: properties.input, requiredFields: ['input'], invocationUrl };
	if (properties.dataframe_split)
		return { format: 'dataframe_split', schema: properties.dataframe_split, requiredFields: ['dataframe_split'], invocationUrl };
	if (properties.dataframe_records)
		return { format: 'dataframe_records', schema: properties.dataframe_records, requiredFields: ['dataframe_records'], invocationUrl };
	if (properties.inputs)
		return { format: 'inputs', schema: properties.inputs, requiredFields: ['inputs'], invocationUrl };
	if (properties.instances)
		return { format: 'instances', schema: properties.instances, requiredFields: ['instances'], invocationUrl };
	return null;
}

function detectInputFormat(openApiSchema: OpenAPISchema): DetectFormatResult {
	const invocationUrl = openApiSchema.servers?.[0]?.url;
	if (!invocationUrl) {
		throw new Error('No server URL found in OpenAPI schema');
	}

	const pathKeys = Object.keys(openApiSchema.paths);
	if (!pathKeys.length) {
		throw new Error('No paths found in OpenAPI schema');
	}

	const invocationPath = pathKeys[0];
	const postOperation = openApiSchema.paths[invocationPath]?.post;

	if (!postOperation?.requestBody?.content?.['application/json']?.schema) {
		throw new Error('No request schema found');
	}

	const schema = postOperation.requestBody.content['application/json'].schema;

	if (schema.oneOf && schema.oneOf.length > 0) {
		for (const option of schema.oneOf) {
			const properties = (option.properties || {}) as Record<string, unknown>;
			const result = detectFormatFromProperties(properties, invocationUrl, true);
			if (result) return result;
		}
	}

	const properties = (schema.properties || {}) as Record<string, unknown>;
	const result = detectFormatFromProperties(properties, invocationUrl);
	if (result) return result;

	return { format: 'generic', schema, requiredFields: [], invocationUrl };
}

function generateExampleFromSchema(schema: unknown, format: string): string {
	const schemaObj = schema as {
		properties?: Record<string, { type?: string; oneOf?: unknown[] }>;
	} | null;
	if (schemaObj?.properties) {
		try {
			const exampleObj: Record<string, unknown> = {};
			for (const [key, propValue] of Object.entries(schemaObj.properties)) {
				const propType = propValue.type;
				if (key === 'messages' && propType === 'array') {
					exampleObj.messages = [{ role: 'user', content: 'Hello! How can you help me today?' }];
				} else if (key === 'prompt' && propType === 'string') {
					exampleObj.prompt = 'What is Databricks?';
				} else if (key === 'input' && propType === 'array') {
					exampleObj.input = ['Text to embed'];
				} else if (key === 'max_tokens' && propType === 'integer') {
					exampleObj.max_tokens = 256;
				} else if (key === 'temperature' && propType === 'number') {
					exampleObj.temperature = 0.7;
				}
			}
			if (Object.keys(exampleObj).length > 0) {
				return JSON.stringify(exampleObj, null, 2);
			}
		} catch {
			// Fall through to default examples
		}
	}

	const examples: Record<string, string> = {
		chat: '{\n  "messages": [\n    { "role": "user", "content": "Hello!" }\n  ],\n  "max_tokens": 256\n}',
		completions: '{\n  "prompt": "What is machine learning?",\n  "max_tokens": 256\n}',
		embeddings: '{\n  "input": ["Example text to embed"]\n}',
		dataframe_split: '{\n  "dataframe_split": {\n    "columns": ["feature1", "feature2"],\n    "data": [[1.0, 2.0]]\n  }\n}',
		dataframe_records: '{\n  "dataframe_records": [{"feature1": 1.0, "feature2": 2.0}]\n}',
		inputs: '{\n  "inputs": {"tensor1": [1, 2, 3]}\n}',
		instances: '{\n  "instances": [{"tensor1": 1}]\n}',
	};

	return examples[format] || '{}';
}

function validateRequestBody(requestBody: Record<string, unknown>, detectedFormat: string): void {
	switch (detectedFormat) {
		case 'chat':
			if (!requestBody.messages || !Array.isArray(requestBody.messages))
				throw new Error('Invalid chat format: "messages" array is required');
			break;
		case 'completions':
			if (!requestBody.prompt) throw new Error('Invalid completions format: "prompt" is required');
			break;
		case 'embeddings':
			if (!requestBody.input) throw new Error('Invalid embeddings format: "input" is required');
			break;
		case 'dataframe_split':
			if (!(requestBody.dataframe_split as Record<string, unknown>)?.data)
				throw new Error('Invalid dataframe_split format: "dataframe_split.data" is required');
			break;
		case 'dataframe_records':
			if (!requestBody.dataframe_records || !Array.isArray(requestBody.dataframe_records))
				throw new Error('Invalid dataframe_records format: "dataframe_records" array is required');
			break;
		case 'inputs':
			if (!requestBody.inputs) throw new Error('Invalid inputs format: "inputs" is required');
			break;
		case 'instances':
			if (!requestBody.instances || !Array.isArray(requestBody.instances))
				throw new Error('Invalid instances format: "instances" array is required');
			break;
	}
}

function sanitizeHeaderValue(value: string): string {
	return value.replace(/[\r\n\0]/g, '');
}

function maskValue(value: string): string {
	if (value.length <= 8) return '****';
	return value.substring(0, 8) + '****';
}

function maskHeaders(headers: Record<string, string>): Record<string, string> {
	const sensitiveKeys = [
		'authorization', 'x-api-key', 'api-key', 'xproxy-api-key',
	];
	const masked: Record<string, string> = {};
	for (const [key, val] of Object.entries(headers)) {
		if (sensitiveKeys.includes(key.toLowerCase())) {
			masked[key] = maskValue(val);
		} else {
			masked[key] = val;
		}
	}
	return masked;
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

export class PayiDatabricksModelServing implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Pay-i Databricks Model Serving',
		name: 'payiDatabricksModelServing',
		icon: 'file:payi_logo.png',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["endpointName"]}}',
		description:
			'Query Databricks Model Serving endpoints through Pay-i proxy for cost tracking, budget enforcement, and observability',
		defaults: {
			name: 'Pay-i Databricks Model Serving',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
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
			{
				displayName: 'Serving Endpoint Name',
				name: 'endpointName',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'e.g. my-llm-endpoint, databricks-meta-llama-3-3-70b-instruct',
				description: 'The name of the Databricks Model Serving endpoint',
			},
			{
				displayName: 'Request Body',
				name: 'requestBody',
				type: 'json',
				required: true,
				default:
					'{\n  "messages": [\n    {\n      "role": "user",\n      "content": "Hello!"\n    }\n  ]\n}',
				description:
					"Request body in JSON format. The node automatically detects the expected format from the endpoint's OpenAPI schema and validates your input at runtime.",
				typeOptions: {
					rows: 10,
				},
			},
			{
				displayName: 'Cloud Provider',
				name: 'cloudProvider',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'AWS', value: 'aws' },
					{ name: 'Azure', value: 'azure' },
					{ name: 'Google Cloud (GCP)', value: 'google' },
					{ name: 'Databricks', value: 'databricks' },
				],
				default: 'aws',
				required: true,
				description:
					'The cloud provider where your Databricks workspace is hosted. Used for cost pricing.',
			},
			...createTrackingFields('databricks', 'endpointName'),
			...outputFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const payiCredentials = await this.getCredentials('payiApi');
		const payiBaseUrl = (payiCredentials.baseUrl as string).replace(/\/+$/, '');
		const payiApiKey = payiCredentials.apiKey as string;

		if (!payiBaseUrl.startsWith('https://')) {
			throw new NodeOperationError(this.getNode(), 'Pay-i Base URL must start with https://');
		}

		const databricksCredentials = await this.getCredentials('payiDatabricksApi');
		const accessToken = databricksCredentials.accessToken as string;
		const workspaceUrl = (databricksCredentials.workspaceUrl as string).replace(/\/+$/, '');

		for (let i = 0; i < items.length; i++) {
			try {
				const endpointName = this.getNodeParameter('endpointName', i) as string;
				const requestBodyRaw = this.getNodeParameter('requestBody', i);
				const cloudProvider = this.getNodeParameter('cloudProvider', i) as string;
				const includeCostData = this.getNodeParameter('includeCostData', i) as boolean;
				const returnFullResponse = this.getNodeParameter('returnFullResponse', i) as boolean;
				const advancedTracking = this.getNodeParameter('advancedTracking', i, {}) as Record<string, unknown>;
				const debugLogging = !!(advancedTracking.debugLogging || this.getNodeParameter('debugLogging', i, false));

				const requestBody =
					typeof requestBodyRaw === 'string'
						? (safeJsonParse(requestBodyRaw, 'Request Body', i, this) as Record<string, unknown>)
						: (requestBodyRaw as Record<string, unknown>);

				// Step 1: Fetch the OpenAPI schema directly from Databricks for format detection
				let detectedFormat = 'generic';
				let exampleRequestBody = '';
				let schemaServerUrl = '';

				try {
					const openApiResponse = await this.helpers.request({
						method: 'GET',
						url: `${workspaceUrl}/api/2.0/serving-endpoints/${endpointName}/openapi`,
						headers: {
							Accept: 'application/json',
							Authorization: `Bearer ${accessToken}`,
						},
						json: true,
					});

					const schemas = Array.isArray(openApiResponse) ? openApiResponse : [openApiResponse];

					if (schemas.length > 0) {
						const schemaInfo = detectInputFormat(schemas[0] as OpenAPISchema);
						detectedFormat = schemaInfo.format;
						schemaServerUrl = schemaInfo.invocationUrl;
						exampleRequestBody = generateExampleFromSchema(schemaInfo.schema, detectedFormat);

						if (debugLogging) {
							this.logger.info(`[Pay-i Databricks MS] OpenAPI servers[0].url: ${schemaServerUrl}`);
						}

						try {
							validateRequestBody(requestBody, detectedFormat);
						} catch (validationError) {
							throw new NodeOperationError(
								this.getNode(),
								`${(validationError as Error).message}\n\nDetected format: ${detectedFormat}\n\nExample request body:\n${exampleRequestBody}\n\nYour request body:\n${JSON.stringify(requestBody, null, 2)}`,
							);
						}
					}
				} catch (error) {
					if (error instanceof NodeOperationError) {
						throw error;
					}
					this.logger.warn('Could not fetch or parse endpoint schema, using default format', {
						endpointName,
						error: (error as Error).message,
					});
					if (!exampleRequestBody) {
						exampleRequestBody = generateExampleFromSchema(null, detectedFormat);
					}
				}

				// Step 2: Build tracking headers
				const userId = this.getNodeParameter('userId', i, '') as string;
				const useCaseName = this.getNodeParameter('useCaseName', i, '') as string;
				const useCaseId = this.getNodeParameter('useCaseId', i, '') as string;
				const useCaseStep = this.getNodeParameter('useCaseStep', i, '') as string;
				const useCaseVersion = (advancedTracking.useCaseVersion as string) || '';
				const useCaseProperties = (advancedTracking.useCaseProperties as string) || '';
				const limitIds = (advancedTracking.limitIds as string) || '';

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

				// Step 3: Route the request through Pay-i proxy
				const invocationUrl = `${payiBaseUrl}/api/v1/proxy/databricks/serving-endpoints/${encodeURIComponent(endpointName)}/invocations`;

				const headers: Record<string, string> = {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`,
					'xProxy-Api-Key': payiApiKey,
					'xProxy-Provider-BaseUri': workspaceUrl,
					'xProxy-PriceAs-Category': `system.databricks.${cloudProvider}`,
					'xProxy-PriceAs-Resource': endpointName,
					...trackingHeaders,
				};
				if (schemaServerUrl) {
					headers['xProxy-Provider-ReferenceUri'] = schemaServerUrl;
				}

				if (debugLogging) {
					this.logger.info(`[Pay-i Databricks MS] ──── REQUEST (item ${i}) ────`);
					this.logger.info(`[Pay-i Databricks MS] POST ${invocationUrl}`);
					this.logger.info(`[Pay-i Databricks MS] Detected format: ${detectedFormat}`);
					this.logger.info(`[Pay-i Databricks MS] Headers: ${JSON.stringify(maskHeaders(headers), null, 2)}`);
				}

				const response = await this.helpers.request({
					method: 'POST',
					url: invocationUrl,
					headers,
					body: requestBody,
					json: true,
				});

				if (debugLogging) {
					this.logger.info(`[Pay-i Databricks MS] ──── RESPONSE (item ${i}) ────`);
					const preview = JSON.stringify(response);
					this.logger.info(`[Pay-i Databricks MS] ${preview.length > 2000 ? preview.substring(0, 2000) + '...(truncated)' : preview}`);
				}

				const outputData = (returnFullResponse ? response : response) as IDataObject;

				if (includeCostData && outputData.xproxy_result !== undefined) {
					outputData.payiCost = outputData.xproxy_result;
					delete outputData.xproxy_result;
				} else {
					delete outputData.xproxy_result;
				}

				returnData.push({
					json: {
						...(outputData as Record<string, unknown>),
						_metadata: { endpoint: endpointName, detectedFormat },
					},
					pairedItem: { item: i },
				});
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
				if (error instanceof NodeOperationError) {
					throw error;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
