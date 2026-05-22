import type { InputExtractionResult, RawInput } from "@/lib/server/input-layer/types";

export type MultimodalProviderName = "mimo-v2-5" | "volcengine-ocr" | "aliyun-ocr" | "tencent-ocr" | "mock" | "manual";

export type MultimodalExtractionPort = {
  readonly provider: MultimodalProviderName;
  extract(input: RawInput): Promise<InputExtractionResult>;
};
