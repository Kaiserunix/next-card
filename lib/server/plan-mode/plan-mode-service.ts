import { PlanModeServiceError } from "@/lib/server/plan-mode/errors";
import { MimoOpenAIClient, type MimoEnv } from "@/lib/server/mimo-openai-client";
import { DeterministicPlanModeProvider } from "@/lib/server/plan-mode/deterministic-plan-provider";
import { MimoPlanModeProvider } from "@/lib/server/plan-mode/mimo-plan-provider";
import { validatePlanModeDraft } from "@/lib/server/plan-mode/plan-output-validator";
import {
  JsonFilePlanModeDraftRepository,
  type PlanModeDraftRepository,
} from "@/lib/server/plan-mode/plan-mode-repository";
import { validatePlanModeRequest } from "@/lib/server/plan-mode/request-validation";
import type { PlanModeDraft, PlanModeProviderPort, PlanModeResponse } from "@/lib/server/plan-mode/types";

export type PlanModeServiceOptions = {
  provider?: PlanModeProviderPort;
  fallbackProvider?: PlanModeProviderPort;
  repository?: PlanModeDraftRepository;
  now?: () => string;
};

type PlanModeProviderEnv = MimoEnv & {
  NEXTCARD_PLAN_MODE_PROVIDER?: string;
  NODE_ENV?: string;
};

export class PlanModeService {
  private readonly provider: PlanModeProviderPort;
  private readonly fallbackProvider: PlanModeProviderPort;
  private readonly repository: PlanModeDraftRepository;
  private readonly now: () => string;

  constructor(options: PlanModeServiceOptions = {}) {
    const fallback = options.fallbackProvider ?? new DeterministicPlanModeProvider();
    this.provider = options.provider ?? createDefaultPlanModeProvider({ fallback });
    this.fallbackProvider = fallback;
    this.repository = options.repository ?? new JsonFilePlanModeDraftRepository();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async createDraft(input: unknown): Promise<PlanModeResponse> {
    const request = validatePlanModeRequest(input);
    const createdAt = this.now();
    const draft = validatePlanModeDraft(
      await this.generateWithFallback(async (provider) => {
        const output = await provider.generatePlanModeDraft({ request, createdAt });
        return output.draft;
      }),
    );

    const saved = await this.repository.saveDraft(draft);
    return { draft: saved };
  }

  private async generateWithFallback(
    generate: (provider: PlanModeProviderPort) => Promise<PlanModeDraft>,
  ): Promise<PlanModeDraft> {
    try {
      const draft = await generate(this.provider);
      validatePlanModeDraft(draft);
      return draft;
    } catch (error) {
      if (this.provider.provider === this.fallbackProvider.provider) {
        throw normalizeProviderError(error);
      }
    }

    try {
      const fallbackDraft = await generate(this.fallbackProvider);
      validatePlanModeDraft(fallbackDraft);
      return fallbackDraft;
    } catch (fallbackError) {
      throw normalizeProviderError(fallbackError);
    }
  }
}

export function createDefaultPlanModeProvider(input: {
  env?: PlanModeProviderEnv;
  fallback?: PlanModeProviderPort;
} = {}): PlanModeProviderPort {
  const env = input.env ?? process.env;
  const fallback = input.fallback ?? new DeterministicPlanModeProvider();
  const requestedProvider = env.NEXTCARD_PLAN_MODE_PROVIDER?.trim().toLowerCase();

  if (requestedProvider === "deterministic-local" || requestedProvider === "deterministic") {
    return fallback;
  }

  const shouldUseMimo = requestedProvider === "mimo" || (env.NODE_ENV !== "test" && Boolean(env.MIMO_API_KEY));
  if (!shouldUseMimo) return fallback;

  return new MimoPlanModeProvider(
    new MimoOpenAIClient({
      env: {
        MIMO_API_KEY: env.MIMO_API_KEY,
        MIMO_BASE_URL: env.MIMO_BASE_URL,
        MIMO_ANTHROPIC_BASE_URL: env.MIMO_ANTHROPIC_BASE_URL,
        MIMO_MODEL: env.MIMO_MODEL,
        MIMO_PLANNER_MODEL: env.MIMO_PLANNER_MODEL,
        MIMO_MULTIMODAL_MODEL: env.MIMO_MULTIMODAL_MODEL,
        MIMO_REQUEST_TIMEOUT_MS: env.MIMO_REQUEST_TIMEOUT_MS,
      },
    }),
  );
}

function normalizeProviderError(error: unknown): PlanModeServiceError {
  if (error instanceof PlanModeServiceError) {
    if (error.code === "PLAN_OUTPUT_INVALID") return error;
    return new PlanModeServiceError("PROVIDER_FAILED", error.message, 502, true);
  }

  return new PlanModeServiceError("PROVIDER_FAILED", "Plan Mode provider failed.", 502, true);
}
