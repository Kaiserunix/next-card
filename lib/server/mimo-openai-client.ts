export type MimoEnv = {
  MIMO_API_KEY?: string;
  MIMO_BASE_URL?: string;
  MIMO_ANTHROPIC_BASE_URL?: string;
  MIMO_MODEL?: string;
  MIMO_PLANNER_MODEL?: string;
  MIMO_MULTIMODAL_MODEL?: string;
  MIMO_REQUEST_TIMEOUT_MS?: string;
};

export type MimoRuntimeConfig = {
  configured: boolean;
  baseUrl: string;
  anthropicBaseUrl: string;
  plannerModel: string;
  multimodalModel: string;
};

export type MimoMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export type MimoChatMessage = {
  role: "system" | "user" | "assistant";
  content: MimoMessageContent;
};

export type MimoChatCompletionRequest = {
  model: string;
  messages: MimoChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json_object";
};

export interface MimoChatCompletionClient {
  getPublicConfig(): MimoRuntimeConfig;
  createChatCompletion(request: MimoChatCompletionRequest): Promise<string>;
}

export type MimoOpenAIClientOptions = {
  env?: MimoEnv;
  fetchImpl?: typeof fetch;
};

const DEFAULT_OPENAI_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const DEFAULT_ANTHROPIC_BASE_URL = "https://token-plan-cn.xiaomimimo.com/anthropic";
const DEFAULT_PLANNER_MODEL = "mimo-v2.5-pro";
const DEFAULT_MULTIMODAL_MODEL = "mimo-v2.5";
const DEFAULT_REQUEST_TIMEOUT_MS = 90000;

export class MimoOpenAIClient implements MimoChatCompletionClient {
  private readonly env: MimoEnv;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MimoOpenAIClientOptions = {}) {
    this.env = options.env ?? readMimoEnv();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getPublicConfig(): MimoRuntimeConfig {
    return getMimoRuntimeConfig(this.env);
  }

  async createChatCompletion(request: MimoChatCompletionRequest): Promise<string> {
    const apiKey = this.env.MIMO_API_KEY;
    if (!apiKey) {
      throw new Error("MIMO_API_KEY is not configured.");
    }

    const config = getMimoRuntimeConfig(this.env);
    const timeoutMs = readTimeoutMs(this.env.MIMO_REQUEST_TIMEOUT_MS);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;

    try {
      response = await this.fetchImpl(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0,
          max_tokens: request.maxTokens ?? 1200,
          response_format: request.responseFormat ? { type: request.responseFormat } : undefined,
          thinking: { type: "disabled" },
        }),
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error(`MiMo request timed out after ${timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`MiMo request failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("MiMo returned an empty response.");
    return content;
  }
}

export function getMimoRuntimeConfig(env: MimoEnv = readMimoEnv()): MimoRuntimeConfig {
  const legacyModel = env.MIMO_MODEL;
  return {
    configured: Boolean(env.MIMO_API_KEY),
    baseUrl: env.MIMO_BASE_URL || DEFAULT_OPENAI_BASE_URL,
    anthropicBaseUrl: env.MIMO_ANTHROPIC_BASE_URL || DEFAULT_ANTHROPIC_BASE_URL,
    plannerModel: env.MIMO_PLANNER_MODEL || (legacyModel && /pro/i.test(legacyModel) ? legacyModel : DEFAULT_PLANNER_MODEL),
    multimodalModel: env.MIMO_MULTIMODAL_MODEL || DEFAULT_MULTIMODAL_MODEL,
  };
}

function readMimoEnv(): MimoEnv {
  return {
    MIMO_API_KEY: process.env.MIMO_API_KEY,
    MIMO_BASE_URL: process.env.MIMO_BASE_URL,
    MIMO_ANTHROPIC_BASE_URL: process.env.MIMO_ANTHROPIC_BASE_URL,
    MIMO_MODEL: process.env.MIMO_MODEL,
    MIMO_PLANNER_MODEL: process.env.MIMO_PLANNER_MODEL,
    MIMO_MULTIMODAL_MODEL: process.env.MIMO_MULTIMODAL_MODEL,
    MIMO_REQUEST_TIMEOUT_MS: process.env.MIMO_REQUEST_TIMEOUT_MS,
  };
}

function readTimeoutMs(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : DEFAULT_REQUEST_TIMEOUT_MS;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
