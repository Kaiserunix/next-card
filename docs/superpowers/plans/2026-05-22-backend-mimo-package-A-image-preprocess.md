# A：图片预处理服务包

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this package task-by-task.

**Goal:** 把图片压缩/降采样从 CLI 抽成可复用服务，降低真实 MiMo 图片调用超时率。

**Architecture:** `lib/server/mimo/image-preprocess.ts` 提供纯服务接口，CLI 和未来 route 复用同一实现。服务只准备 data URL 和审计元数据，不调用 MiMo、不写业务状态。

**Tech Stack:** TypeScript, Node.js fs/path, Windows PowerShell System.Drawing fallback, Vitest.

---

## 目标

把 `scripts/real-mimo-test-service.mjs` 里的图片压缩/降采样能力抽成可复用后端服务，供 CLI 和未来 import route 共用。解决大 PNG 直发 MiMo 超时的问题。

## 文件

- Create: `lib/server/mimo/image-preprocess.ts`
- Test: `tests/server/mimo/image-preprocess.test.ts`
- Modify: `scripts/real-mimo-test-service.mjs`

## 接口

```ts
export type ImagePreprocessOptions = {
  maxSide: number;
  jpegQuality: number;
  maxOriginalBytes: number;
  force?: boolean;
};

export type ImagePreprocessResult = {
  originalPath: string;
  preparedPath: string;
  originalBytes: number;
  preparedBytes: number;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  resized: boolean;
  dataUrl: string;
};

export async function prepareImageForMimo(
  imagePath: string,
  outputDir: string,
  options: ImagePreprocessOptions,
): Promise<ImagePreprocessResult>;
```

## 步骤

- [ ] 写 `tests/server/mimo/image-preprocess.test.ts`，覆盖：
  - 小 JPG 不强制 resize 时保持原图。
  - 大 PNG 自动输出 JPG。
  - `dataUrl` mime 正确。
  - `preparedBytes < originalBytes`。
  - 输出路径留在传入的 `outputDir` 内。
- [ ] 创建 `lib/server/mimo/image-preprocess.ts`。
- [ ] Windows 环境使用 `System.Drawing` 压缩；非 Windows 返回清晰错误。
- [ ] 把 `scripts/real-mimo-test-service.mjs` 的内联 resize 逻辑替换为服务调用。
- [ ] 确认 CLI report 仍写 `originalBytes / sentBytes / resized`。

## 验收

```powershell
pnpm test tests/server/mimo/image-preprocess.test.ts tests/scripts/real-mimo-test-service.test.ts
pnpm real:mimo -- --mode image --image-dir "C:\Users\qwerf\.codex\generated_images\019e4957-65a1-7460-b2ae-a705d832703d" --limit 1 --timeout-ms 180000
pnpm typecheck
pnpm lint
```

## 不做

- 不做 OCR。
- 不做 PDF/DOCX。
- 不接 UI 上传。
