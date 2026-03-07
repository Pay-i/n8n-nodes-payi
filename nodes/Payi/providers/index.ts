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
				headers: { Authorization: `Bearer ${apiKey}` },
				method: 'POST',
			};

		case 'anthropic':
			return {
				urlPath: 'anthropic/v1/messages',
				body: { model, max_tokens: 1024 },
				headers: {
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
				},
				method: 'POST',
			};

		case 'azureOpenai': {
			const deployment = context.getNodeParameter('azureDeploymentName', itemIndex) as string;
			const apiVersion = context.getNodeParameter('azureApiVersion', itemIndex) as string;
			return {
				urlPath: `azure.openai/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
				body: {},
				headers: { 'api-key': apiKey },
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
			const workspaceUrl = (context.getNodeParameter('databricksWorkspaceUrl', itemIndex) as string).replace(/\/+$/, '');
			const endpointName = context.getNodeParameter('databricksEndpointName', itemIndex) as string;
			const cloudProvider = context.getNodeParameter('databricksCloudProvider', itemIndex) as string;
			// Derive AI Gateway URL from workspace URL
			const gatewayUrl = workspaceUrl.replace(
				/^(https:\/\/[^.]+)\.(cloud\.databricks\.com|azuredatabricks\.net)/,
				'$1.ai-gateway.$2',
			) + '/mlflow';
			return {
				urlPath: 'openai/v1/chat/completions',
				body: { model: endpointName },
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'xProxy-Provider-BaseUri': gatewayUrl,
					'xProxy-PriceAs-Category': `system.databricks.${cloudProvider}`,
				},
				method: 'POST',
			};
		}

		default:
			throw new NodeOperationError(context.getNode(), `Unsupported provider: ${provider}`);
	}
}
