import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareImageForMimo } from "@/lib/server/mimo/image-preprocess";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("prepareImageForMimo", () => {
  it("keeps a small JPG unchanged when resize is not forced", async () => {
    const dir = await tempDir();
    const source = join(dir, "small.jpg");
    await writeFile(source, Buffer.from(SMALL_JPG_BASE64, "base64"));

    const result = await prepareImageForMimo(source, join(dir, "out"), {
      maxSide: 1280,
      jpegQuality: 76,
      maxOriginalBytes: 100_000,
    });

    expect(result.originalPath).toBe(resolve(source));
    expect(result.preparedPath).toBe(resolve(source));
    expect(result.resized).toBe(false);
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.preparedBytes).toBe(result.originalBytes);
    expect(result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  const itOnWindows = process.platform === "win32" ? it : it.skip;

  itOnWindows("converts a large PNG to a smaller JPG inside the requested output directory", async () => {
    const dir = await tempDir();
    const outputDir = join(dir, "prepared");
    const source = join(dir, "large.png");
    await writeFile(source, Buffer.concat([Buffer.from(SMALL_PNG_BASE64, "base64"), Buffer.alloc(20_000)]));

    const result = await prepareImageForMimo(source, outputDir, {
      maxSide: 640,
      jpegQuality: 70,
      maxOriginalBytes: 1_000,
    });

    const resolvedOutput = `${resolve(outputDir)}${sep}`;
    expect(result.preparedPath.startsWith(resolvedOutput)).toBe(true);
    expect(result.preparedPath.endsWith(".jpg")).toBe(true);
    expect(result.resized).toBe(true);
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(result.preparedBytes).toBeLessThan(result.originalBytes);
  });
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "nextcard-image-preprocess-"));
  tempDirs.push(dir);
  return dir;
}

const SMALL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

const SMALL_JPG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/ISf/2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAARD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAARD/2gAIAQIBAT8QH//EFBQBAQAAAAAAAAAAAAAAAAAAARD/2gAIAQEAAT8QH//Z";
