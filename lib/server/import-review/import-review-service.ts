import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { confirmFacts } from "@/lib/server/input-layer/fact-confirmation-service";
import { MockMultimodalExtractor } from "@/lib/server/input-layer/mock-multimodal-extractor";
import type { MultimodalExtractionPort } from "@/lib/server/input-layer/multimodal-port";
import { InMemoryRawInputRepository, type RawInputRepository } from "@/lib/server/input-layer/raw-input-repository";
import { createRawInput } from "@/lib/server/input-layer/raw-input-service";
import { runReviewGate } from "@/lib/server/input-layer/review-gate";
import { extractTextInput } from "@/lib/server/input-layer/text-extraction-worker";
import type { InputExtractionResult, RawInputSourceType } from "@/lib/server/input-layer/types";
import type { ImportReviewCommand, ImportReviewProviderUsage, ImportReviewReport } from "@/lib/server/import-review/types";

export type ImportReviewServiceOptions = {
  rawInputRepository?: RawInputRepository;
  multimodalExtractor?: MultimodalExtractionPort;
  uploadDir?: string;
  preparedImageDir?: string;
};

const TEXT_LIKE_SOURCES = new Set<RawInputSourceType>(["text", "manual-dictation", "voice"]);
const DEFAULT_UPLOAD_DIR = join(process.cwd(), ".nextcard-data", "import-uploads");
const DEFAULT_PREPARED_IMAGE_DIR = join(process.cwd(), ".nextcard-data", "import-prepared-images");
const DEFAULT_MIMO_MULTIMODAL_MODEL = "mimo-v2.5";

export class ImportReviewService {
  private readonly rawInputRepository: RawInputRepository;
  private readonly multimodalExtractor: MultimodalExtractionPort;
  private readonly uploadDir: string;

  constructor(options: ImportReviewServiceOptions = {}) {
    this.rawInputRepository = options.rawInputRepository ?? new InMemoryRawInputRepository();
    this.uploadDir = resolve(options.uploadDir ?? process.env.NEXTCARD_IMPORT_UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR);
    this.multimodalExtractor =
      options.multimodalExtractor ??
      new LazyMimoMultimodalExtractor(resolve(options.preparedImageDir ?? join(this.uploadDir, "prepared")));
  }

  async review(command: ImportReviewCommand): Promise<ImportReviewReport> {
    const contentRef = await this.resolveContentRef(command);
    const rawInputResult = await createRawInput(
      {
        sourceType: command.sourceType,
        text: command.text,
        contentRef,
        anonymousDeviceId: command.clientContext?.anonymousDeviceId ?? "anonymous-import-device",
        userId: command.clientContext?.userId,
        locale: command.clientContext?.locale,
        timezone: command.clientContext?.timezone,
        receivedAt: command.clientContext?.now,
      },
      this.rawInputRepository,
    );
    const extraction = await this.extract(command.sourceType, rawInputResult.rawInput);
    const reviewGate = runReviewGate({
      rawInput: rawInputResult.rawInput,
      extraction,
    });
    const confirmation = command.confirmationAction
      ? confirmFacts({
          request: reviewGate.confirmationRequest,
          action: command.confirmationAction,
          corrections: command.corrections,
          sourceType: command.sourceType,
        })
      : undefined;

    return {
      reportId: `import_report_${randomUUID()}`,
      rawInputId: rawInputResult.rawInput.id,
      sourceType: command.sourceType,
      extraction,
      reviewGate,
      canProceedToPlanMode: Boolean(confirmation?.planCompilerHandoff),
      planCompilerHandoff: confirmation?.planCompilerHandoff,
      boundaryWarnings: boundaryWarnings(reviewGate.requirement),
      providerUsage: this.providerUsage(command.sourceType),
    };
  }

  private async extract(sourceType: RawInputSourceType, rawInput: Parameters<typeof extractTextInput>[0]): Promise<InputExtractionResult> {
    if (TEXT_LIKE_SOURCES.has(sourceType)) return extractTextInput(rawInput);
    if (sourceType === "notification" && rawInput.text && !rawInput.contentRef) return extractTextInput(rawInput);
    return this.multimodalExtractor.extract(rawInput);
  }

  private async resolveContentRef(command: ImportReviewCommand): Promise<string | undefined> {
    if (command.filePath) return resolve(command.filePath);
    if (!command.file) return undefined;

    await mkdir(this.uploadDir, { recursive: true });
    const ext = safeExtension(command.file.name);
    const outputPath = resolve(this.uploadDir, `${randomUUID()}${ext}`);
    await writeFile(outputPath, Buffer.from(await command.file.arrayBuffer()));
    return outputPath;
  }

  private providerUsage(sourceType: RawInputSourceType): ImportReviewProviderUsage {
    if (TEXT_LIKE_SOURCES.has(sourceType) || sourceType === "notification") {
      return { provider: "manual", used: true };
    }

    if (this.multimodalExtractor instanceof MockMultimodalExtractor || this.multimodalExtractor.provider === "mock") {
      return { provider: "mock", used: true };
    }

    return {
      provider: "mimo",
      model: process.env.MIMO_MULTIMODAL_MODEL || DEFAULT_MIMO_MULTIMODAL_MODEL,
      used: true,
    };
  }
}

class LazyMimoMultimodalExtractor implements MultimodalExtractionPort {
  readonly provider = "mimo-v2-5" as const;

  constructor(private readonly preparedImageDir: string) {}

  async extract(rawInput: Parameters<MultimodalExtractionPort["extract"]>[0]): ReturnType<MultimodalExtractionPort["extract"]> {
    const [{ MimoOpenAIClient }, { MimoMultimodalExtractor }] = await Promise.all([
      import("@/lib/server/mimo-openai-client"),
      import("@/lib/server/input-layer/mimo-multimodal-extractor"),
    ]);
    const extractor = new MimoMultimodalExtractor({
      client: new MimoOpenAIClient(),
      imageOutputDir: this.preparedImageDir,
      preprocessOptions: {
        maxSide: 1280,
        jpegQuality: 76,
        maxOriginalBytes: 350_000,
      },
    });

    return extractor.extract(rawInput);
  }
}

function boundaryWarnings(requirement: ImportReviewReport["reviewGate"]["requirement"]): string[] {
  return [
    "input-layer-only: no committed deck, card runtime, reminder, proof, or profile writes",
    "llm-output-candidate-only: deterministic review gate remains authoritative",
    "must-generate-abc: PlanCompilerHandoff must still enter explicit A/B/C Plan Mode",
    ...(requirement === "strict" || requirement === "blocked" ? ["high-risk import requires review before Plan Mode"] : []),
  ];
}

function safeExtension(fileName: string): string {
  const ext = extname(fileName).toLowerCase();
  if (/^\.(jpg|jpeg|png|webp|pdf|docx|txt)$/.test(ext)) return ext;
  return ".bin";
}
