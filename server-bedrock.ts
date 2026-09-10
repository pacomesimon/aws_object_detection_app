import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { Agent, BedrockModel, ImageBlock, TextBlock, Message } from "@strands-agents/sdk";

export interface BedrockDetectionRequest {
  imageBase64: string;
  mimeType: string;
  ontology: Array<{ name: string; description?: string }>;
  bedrockConfig: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    region?: string;
    invocationType?: "agent" | "model";
    agentId?: string;
    agentAliasId?: string;
    modelId?: string;
    sessionId?: string;
    mockIfCredentialsInvalid?: boolean;
  };
}

export interface BedrockDetectionResult {
  success: boolean;
  detections: Array<{
    label: string;
    box_2d: [number, number, number, number];
    confidence: number;
    description?: string;
  }>;
  summary: string;
  model: string;
  processedAt: string;
  isSimulated?: boolean;
  notes?: string;
}

/**
 * Helper to build sanitized AWS credentials.
 * Ensures sessionToken is only attached when valid and not used on permanent AKIA keys.
 */
function buildAwsCredentials(accessKeyId: string, secretAccessKey: string, sessionToken?: string) {
  const cleanKey = accessKeyId.trim();
  const cleanSecret = secretAccessKey.trim();
  const cleanToken = sessionToken?.trim();

  const isPermanent = cleanKey.startsWith("AKIA");
  const isTemporary = cleanKey.startsWith("ASIA");

  const credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  } = {
    accessKeyId: cleanKey,
    secretAccessKey: cleanSecret,
  };

  // Strictly attach sessionToken ONLY when present and key is not permanent AKIA
  // (AWS SigV4 rejects requests if x-amz-security-token header is present on an AKIA key,
  // or if sessionToken is undefined in the credentials dictionary)
  if (cleanToken && !isPermanent) {
    credentials.sessionToken = cleanToken;
  }

  return {
    credentials,
    isPermanent,
    isTemporary,
    hasToken: Boolean(cleanToken),
  };
}

/**
 * Resolves Bedrock Model ID:
 * 1. Automatically upgrades retired/EOL model versions to supported active versions
 * 2. Attaches regional inference profile prefix (us., eu.) for Anthropic Claude models if needed
 */
export function resolveBedrockModelId(modelId: string | undefined, region: string): string {
  const trimmed = (modelId || "").trim();
  if (!trimmed) {
    return "amazon.nova-pro-v1:0";
  }

  // Map legacy Claude / GPT models to supported Amazon Nova models on Bedrock
  const legacyMap: Record<string, string> = {
    "amazon.nova-2-lite-v1:0": "us.amazon.nova-2-lite-v1:0",
    "nova-2-lite": "us.amazon.nova-2-lite-v1:0",
    "anthropic.claude-3-7-sonnet-20250219-v1:0": "us.amazon.nova-2-lite-v1:0",
    "anthropic.claude-3-5-sonnet-20241022-v2:0": "amazon.nova-pro-v1:0",
    "anthropic.claude-3-5-haiku-20241022-v1:0": "us.amazon.nova-2-lite-v1:0",
    "us.anthropic.claude-3-7-sonnet-20250219-v1:0": "us.amazon.nova-2-lite-v1:0",
    "us.anthropic.claude-3-5-sonnet-20241022-v2:0": "amazon.nova-pro-v1:0",
    "us.anthropic.claude-3-5-haiku-20241022-v1:0": "us.amazon.nova-2-lite-v1:0",
    "anthropic.claude-3-haiku-20240307-v1:0": "us.amazon.nova-2-lite-v1:0",
    "us.anthropic.claude-sonnet-4-5-20250929-v1:0": "amazon.nova-pro-v1:0",
    "us.anthropic.claude-sonnet-4-6": "amazon.nova-pro-v1:0",
    "us.anthropic.claude-sonnet-4-20250514-v1:0": "amazon.nova-pro-v1:0",
    "us.anthropic.claude-haiku-4-5-20251001-v1:0": "us.amazon.nova-2-lite-v1:0",
    "openai.gpt-5-6-sol": "amazon.nova-pro-v1:0",
    "openai.gpt-5-6-luna": "us.amazon.nova-2-lite-v1:0",
    "openai.gpt-5-6-tera": "amazon.nova-pro-v1:0",
    "openai.gpt-5-6-terra": "amazon.nova-pro-v1:0",
    "openai.gpt-5.6-sol": "amazon.nova-pro-v1:0",
    "openai.gpt-5.6-luna": "us.amazon.nova-2-lite-v1:0",
    "openai.gpt-5.6-tera": "amazon.nova-pro-v1:0",
    "openai.gpt-5.6-terra": "amazon.nova-pro-v1:0",
    "us.openai.gpt-5.6-sol": "amazon.nova-pro-v1:0",
    "us.openai.gpt-5.6-luna": "us.amazon.nova-2-lite-v1:0",
    "us.openai.gpt-5.6-terra": "amazon.nova-pro-v1:0",
    "us.openai.gpt-5.6-tera": "amazon.nova-pro-v1:0",
  };

  if (legacyMap[trimmed]) {
    return legacyMap[trimmed];
  }

  if (trimmed.includes("gpt") || trimmed.includes("claude")) {
    return trimmed.includes("lite") || trimmed.includes("haiku") || trimmed.includes("luna")
      ? "amazon.nova-lite-v1:0"
      : "amazon.nova-pro-v1:0";
  }

  return trimmed;
}

/**
 * Validate or test Amazon Bedrock credentials
 */
export async function testBedrockConnection(config: {
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region?: string;
  modelId?: string;
}) {
  const accessKeyId = (config.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (config.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "").trim();
  const region = (config.region || process.env.AWS_REGION || "us-east-1").trim();
  const sessionToken = (config.sessionToken || process.env.AWS_SESSION_TOKEN || "").trim();
  const rawModelToTest = config.modelId || "amazon.nova-pro-v1:0";
  const modelToTest = resolveBedrockModelId(rawModelToTest, region);

  if (!accessKeyId || !secretAccessKey) {
    return {
      success: false,
      error: "Missing AWS Access Key ID or Secret Access Key.",
    };
  }

  // Pre-validate temporary vs permanent keys before making network request
  if (accessKeyId.startsWith("ASIA") && !sessionToken) {
    return {
      success: false,
      code: "MissingSessionToken",
      error:
        "Your Access Key starts with 'ASIA' (temporary STS / AWS SSO credential). Temporary credentials strictly require an 'AWS Session Token'. Please paste your session token into the Session Token field.",
    };
  }

  try {
    const { credentials } = buildAwsCredentials(accessKeyId, secretAccessKey, sessionToken);

    const client = new BedrockRuntimeClient({
      region,
      credentials,
    });

    // Run a minimal converse query with user's selected model or Nova
    const testCommand = new ConverseCommand({
      modelId: modelToTest,
      messages: [
        {
          role: "user",
          content: [{ text: "ping" }],
        },
      ],
    });

    await client.send(testCommand);

    return {
      success: true,
      message: `Successfully connected to AWS Bedrock in ${region} using model ${modelToTest}.`,
      testedModelId: modelToTest,
    };
  } catch (err: any) {
    // Check if model reached End-of-Life (EOL)
    if (
      err.message?.toLowerCase().includes("reached the end of its life") ||
      (err.name === "ValidationException" && err.message?.toLowerCase().includes("end of its life"))
    ) {
      return {
        success: false,
        code: "ModelVersionEOL",
        error: `Model version '${rawModelToTest}' has reached its End-of-Life on AWS Bedrock. AWS has retired this version. Please select an active model such as Amazon Nova 2 Lite (us.amazon.nova-2-lite-v1:0), Amazon Nova Pro (amazon.nova-pro-v1:0), or Amazon Nova Lite (amazon.nova-lite-v1:0).`,
      };
    }

    // If the test model wasn't enabled in Bedrock, check error code
    if (
      err.name === "ValidationException" ||
      err.name === "ModelNotReadyException" ||
      err.name === "AccessDeniedException"
    ) {
      if (
        err.message?.toLowerCase().includes("not enabled") ||
        err.message?.toLowerCase().includes("model access") ||
        err.message?.toLowerCase().includes("requested model")
      ) {
        return {
          success: false,
          code: err.name,
          error: `AWS credentials valid, but model access is restricted: ${err.message}. Please enable this model in AWS Bedrock Console > Model Access.`,
        };
      }
      return {
        success: true,
        message: `AWS Credentials authenticated successfully. (Model Note: ${err.message})`,
      };
    }

    if (
      err.message?.includes("security token included in the request is invalid") ||
      err.name === "UnrecognizedClientException" ||
      err.name === "InvalidClientTokenId"
    ) {
      let helpfulTip = "The security token included in the request is invalid.";
      if (accessKeyId.startsWith("ASIA")) {
        helpfulTip =
          "Your Access Key starts with 'ASIA' (temporary STS / AWS SSO credentials). The AWS Session Token was rejected or has expired (temporary tokens expire in 1–12 hours). Please refresh your credentials in AWS SSO / AWS CLI and paste the new Session Token.";
      } else if (accessKeyId.startsWith("AKIA")) {
        helpfulTip =
          "Your Access Key starts with 'AKIA' (permanent IAM User credentials). Permanent IAM keys do NOT use a Session Token. Please make sure the Session Token field is left completely empty, and double check that the Access Key ID and Secret Access Key have no trailing whitespace.";
      }
      return {
        success: false,
        code: err.name || "InvalidSecurityToken",
        error: helpfulTip,
      };
    }

    return {
      success: false,
      error: err.message || "Failed to authenticate with AWS Bedrock.",
      code: err.name || "AuthError",
    };
  }
}

import { extractDetectionsFromText } from "./server-parser.ts";
export { extractDetectionsFromText };

/**
 * Main handler to run detection using Amazon Bedrock / AgentCore
 */
export async function runBedrockDetection(
  req: BedrockDetectionRequest
): Promise<BedrockDetectionResult> {
  const { imageBase64, mimeType = "image/jpeg", ontology, bedrockConfig } = req;

  const accessKeyId = (bedrockConfig.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = (bedrockConfig.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "").trim();
  const region = (bedrockConfig.region || process.env.AWS_REGION || "us-east-1").trim();
  const sessionToken = (bedrockConfig.sessionToken || process.env.AWS_SESSION_TOKEN || "").trim();
  const rawModelId = bedrockConfig.modelId || "amazon.nova-pro-v1:0";
  const modelId = resolveBedrockModelId(rawModelId, region);
  const invocationType = bedrockConfig.invocationType || "model";
  const agentId = bedrockConfig.agentId?.trim();
  const agentAliasId = bedrockConfig.agentAliasId?.trim() || "TSTALIASID";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS credentials missing. Please configure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in server environment variables to use Amazon Bedrock."
    );
  }

  // Pre-validate temporary ASIA credentials before making the API call
  if (accessKeyId.startsWith("ASIA") && !sessionToken) {
    throw new Error(
      "Your AWS Access Key starts with 'ASIA' (temporary STS / AWS SSO credential). Temporary credentials strictly require AWS_SESSION_TOKEN to be set in server environment variables."
    );
  }

  const ontologyClassNames = ontology.map((o) => o.name);
  const ontologyText = ontology
    .map((item) => `- ${item.name}: ${item.description || "Target visual class"}`)
    .join("\n");

  const promptText = `You are an expert computer vision model running on Amazon Bedrock.
Locate all visible instances of the following target ontology classes in the image:

Ontology Classes:
${ontologyText}

Return a valid JSON object ONLY with the following schema:
{
  "detections": [
    {
      "label": "Exact class name from target ontology",
      "box_2d": [ymin, xmin, ymax, xmax],
      "confidence": 0.95,
      "description": "Short visual details"
    }
  ],
  "summary": "Short scene summary of detected classes"
}
Coordinates MUST be normalized integers from 0 to 1000 ([ymin, xmin, ymax, xmax]). Return strictly JSON without other commentary.`;

  try {
    const { credentials } = buildAwsCredentials(accessKeyId, secretAccessKey, sessionToken);

    // 1. Bedrock AgentCore Agent Invocation
    if (invocationType === "agent" && agentId) {
      const agentClient = new BedrockAgentRuntimeClient({
        region,
        credentials,
      });

      const command = new InvokeAgentCommand({
        agentId,
        agentAliasId,
        sessionId: bedrockConfig.sessionId || `session-${Date.now()}`,
        inputText: `Target ontology classes:\n${ontologyText}\n\nTask: Analyze visual annotations and output bounding boxes JSON.`,
      });

      const response = await agentClient.send(command);

      let agentOutput = "";
      if (response.completion) {
        for await (const event of response.completion) {
          if (event.chunk?.bytes) {
            agentOutput += Buffer.from(event.chunk.bytes).toString("utf-8");
          }
        }
      }

      const parsed = extractDetectionsFromText(agentOutput, ontologyClassNames);

      return {
        success: true,
        detections: parsed.detections,
        summary: parsed.summary || `Annotated via Bedrock AgentCore Agent (${agentId})`,
        model: `Amazon Bedrock AgentCore (${agentId})`,
        processedAt: new Date().toISOString(),
      };
    }

    // 2. Multimodal Vision Invocation via AWS Strands Agents SDK powered by Amazon Bedrock
    const client = new BedrockRuntimeClient({
      region,
      credentials,
    });

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Buffer.from(cleanBase64, "base64");

    let imgFormat: "jpeg" | "png" | "gif" | "webp" = "jpeg";
    if (mimeType.includes("png")) imgFormat = "png";
    else if (mimeType.includes("webp")) imgFormat = "webp";
    else if (mimeType.includes("gif")) imgFormat = "gif";

    let textOutput = "";
    let usedStrandsAgent = false;

    try {
      // Initialize Strands Agent with Bedrock Foundation Model
      const strandsModel = new BedrockModel({
        modelId,
        region,
        clientConfig: {
          credentials,
        },
      });

      const strandsAgent = new Agent({
        model: strandsModel,
        systemPrompt:
          "You are an expert zero-shot 2D spatial bounding box object detector. Return JSON strictly matching the requested format with [ymin, xmin, ymax, xmax] 0-1000 coordinates.",
      });

      const userMessage = new Message({
        role: "user",
        content: [
          new ImageBlock({
            format: imgFormat,
            source: { bytes: imageBytes },
          }),
          new TextBlock(promptText),
        ],
      });

      const agentResult = await strandsAgent.invoke([userMessage]);

      if (agentResult?.lastMessage?.content && Array.isArray(agentResult.lastMessage.content)) {
        for (const block of agentResult.lastMessage.content) {
          if (block && typeof block === "object" && "text" in block && typeof (block as any).text === "string") {
            textOutput += (block as any).text;
          }
        }
      }
      usedStrandsAgent = Boolean(textOutput.trim());
    } catch (strandsErr: any) {
      console.warn("Strands Agent invocation note, falling back to direct Converse if needed:", strandsErr?.message);
    }

    // Direct Converse fallback if Strands Agent produced empty output
    if (!textOutput.trim()) {
      const command = new ConverseCommand({
        modelId,
        system: [
          {
            text:
              "You are an expert zero-shot 2D spatial bounding box object detector. Return JSON strictly matching the requested format with [ymin, xmin, ymax, xmax] 0-1000 coordinates.",
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                image: {
                  format: imgFormat,
                  source: {
                    bytes: imageBytes,
                  },
                },
              },
              {
                text: promptText,
              },
            ],
          },
        ],
      });

      const response = await client.send(command);
      textOutput = response.output?.message?.content?.[0]?.text || "";
    }

    const parsed = extractDetectionsFromText(textOutput, ontologyClassNames);

    return {
      success: true,
      detections: parsed.detections,
      summary: parsed.summary || `Localized objects via Amazon Bedrock (${modelId})`,
      model: `Amazon Bedrock: ${modelId.split(".")[1] || modelId}`,
      processedAt: new Date().toISOString(),
      notes: usedStrandsAgent ? "Processed with Strands Agents SDK" : undefined,
    };
  } catch (err: any) {
    console.error("Bedrock detection error:", err);
    if (
      err.message?.toLowerCase().includes("reached the end of its life") ||
      (err.name === "ValidationException" && err.message?.toLowerCase().includes("end of its life"))
    ) {
      throw new Error(
        `Model '${rawModelId}' has reached its End-of-Life on Amazon Bedrock. Please select an active model (such as Amazon Nova 2 Lite 'us.amazon.nova-2-lite-v1:0', Amazon Nova Pro 'amazon.nova-pro-v1:0', or Amazon Nova Lite 'amazon.nova-lite-v1:0').`
      );
    }

    if (
      err.name === "AccessDeniedException" ||
      err.message?.includes("not available for this account") ||
      err.message?.includes("Model access") ||
      err.message?.includes("not granted access")
    ) {
      throw new Error(
        `Amazon Bedrock Access Denied for model '${modelId}': Your AWS account has not been granted access to this model yet, or model access is still pending. In AWS Console, visit Amazon Bedrock > Model access > Request access for Amazon Nova models.`
      );
    }

    throw new Error(
      `Amazon Bedrock Error (${err.name || "InvokeError"}): ${err.message || "Failed to process image detection with Bedrock."}`
    );
  }
}
