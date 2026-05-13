import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export interface ProviderRequest {
	urlPath: string;
	body: object;
	headers: Record<string, string>;
	method: string;
}

export async function buildProviderRequest(
	context: IExecuteFunctions,
	itemIndex: number,
): Promise<ProviderRequest> {
	const provider = context.getNodeParameter('provider', itemIndex) as string;
	const apiKey = context.getNodeParameter('providerApiKey', itemIndex) as string;
	const model = context.getNodeParameter('model', itemIndex) as string;

	switch (provider) {
		case 'openai':
			return {
				urlPath: 'openai/v1/chat/completions',
				body: { model },
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'xProxy-PriceAs-Resource': model,
				},
				method: 'POST',
			};

		case 'anthropic':
			return {
				urlPath: 'anthropic/v1/messages',
				body: { model, max_tokens: 1024 },
				headers: {
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
					'xProxy-PriceAs-Resource': model,
				},
				method: 'POST',
			};

		case 'azureOpenai': {
			const deployment = context.getNodeParameter('azureDeploymentName', itemIndex) as string;
			const apiVersion = context.getNodeParameter('azureApiVersion', itemIndex) as string;
			return {
				urlPath: `azure.openai/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
				body: {},
				headers: {
					'api-key': apiKey,
					'xProxy-PriceAs-Resource': deployment,
				},
				method: 'POST',
			};
		}

		case 'bedrock': {
			const secretKey = context.getNodeParameter('bedrockSecretKey', itemIndex) as string;
			const sessionToken = context.getNodeParameter('bedrockSessionToken', itemIndex, '') as string;
			const region = context.getNodeParameter('bedrockRegion', itemIndex) as string;
			const headers: Record<string, string> = {
				'x-amz-access-key-id': apiKey,
				'x-amz-secret-access-key': secretKey,
				'xProxy-PriceAs-Resource': model,
			};
			if (sessionToken) headers['x-amz-session-token'] = sessionToken;
			return {
				urlPath: `aws.bedrock/${encodeURIComponent(region)}/model/${encodeURIComponent(model)}/converse`,
				body: {},
				headers,
				method: 'POST',
			};
		}

		case 'databricks': {
			const databricksCredentials = await context.getCredentials('payiDatabricksApi');
			const accessToken = databricksCredentials.accessToken as string;
			const workspaceUrl = (databricksCredentials.workspaceUrl as string).replace(/\/+$/, '');
			const endpointName = context.getNodeParameter('databricksEndpointName', itemIndex) as string;
			const cloudProvider = context.getNodeParameter('databricksCloudProvider', itemIndex) as string;
			const priceAsResourceOverride = context.getNodeParameter('databricksPriceAsResource', itemIndex, '') as string;

			// PriceAs-Resource resolution:
			//   1. Explicit override → use it
			//   2. Endpoint name starts with "databricks-" (foundation model) → use endpoint name
			//   3. Custom endpoint name → fall back to a known foundation model so Pay-i can price it
			const DEFAULT_FOUNDATION_MODEL = 'databricks-gpt-5-4';
			const FOUNDATION_PATTERN = /^databricks-/;
			let priceAsResource: string;
			if (priceAsResourceOverride.trim()) {
				priceAsResource = priceAsResourceOverride.trim();
			} else if (FOUNDATION_PATTERN.test(endpointName)) {
				priceAsResource = endpointName;
			} else {
				priceAsResource = DEFAULT_FOUNDATION_MODEL;
			}

			// Route through Pay-i's Databricks-native proxy path.
			// Pay-i forwards to `<workspace>/serving-endpoints/<endpoint>/invocations`.
			return {
				urlPath: `databricks/serving-endpoints/${encodeURIComponent(endpointName)}/invocations`,
				body: {},
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'xProxy-Provider-BaseUri': workspaceUrl,
					'xProxy-PriceAs-Category': `system.databricks.${cloudProvider}`,
					'xProxy-PriceAs-Resource': priceAsResource,
				},
				method: 'POST',
			};
		}

		default:
			throw new NodeOperationError(context.getNode(), `Unsupported provider: ${provider}`);
	}
}
