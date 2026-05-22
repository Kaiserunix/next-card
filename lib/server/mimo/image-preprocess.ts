import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
): Promise<ImagePreprocessResult> {
  const originalPath = resolve(imagePath);
  const resolvedOutputDir = resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });

  const source = await stat(originalPath);
  const originalBytes = source.size;
  const originalMimeType = mimeTypeForPath(originalPath);
  const shouldResize = Boolean(options.force) || originalBytes > options.maxOriginalBytes;

  if (!shouldResize) {
    return {
      originalPath,
      preparedPath: originalPath,
      originalBytes,
      preparedBytes: originalBytes,
      mimeType: originalMimeType,
      resized: false,
      dataUrl: await toDataUrl(originalPath, originalMimeType),
    };
  }

  if (process.platform !== "win32") {
    throw new Error("Image preprocessing currently requires Windows System.Drawing.");
  }

  const outputPath = resolve(
    resolvedOutputDir,
    `${safeFileName(basename(originalPath, extname(originalPath)))}-${randomUUID().slice(0, 8)}.jpg`,
  );
  assertPathInside(outputPath, resolvedOutputDir);
  await resizeImageWithPowerShell({
    inputPath: originalPath,
    outputPath,
    outputDir: resolvedOutputDir,
    maxSide: options.maxSide,
    jpegQuality: options.jpegQuality,
  });
  const preparedBytes = (await stat(outputPath)).size;

  return {
    originalPath,
    preparedPath: outputPath,
    originalBytes,
    preparedBytes,
    mimeType: "image/jpeg",
    resized: true,
    dataUrl: await toDataUrl(outputPath, "image/jpeg"),
  };
}

function mimeTypeForPath(filePath: string): ImagePreprocessResult["mimeType"] {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  throw new Error(`Unsupported image type for MiMo preprocessing: ${ext || "unknown"}`);
}

async function toDataUrl(filePath: string, mimeType: ImagePreprocessResult["mimeType"]): Promise<string> {
  const bytes = await readFile(filePath);
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function resizeImageWithPowerShell(input: {
  inputPath: string;
  outputPath: string;
  outputDir: string;
  maxSide: number;
  jpegQuality: number;
}): Promise<void> {
  const scriptPath = resolve(input.outputDir, "resize-image-for-mimo.ps1");
  await writeFile(scriptPath, resizeScript(), "utf8");
  const { stdout, stderr } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      input.inputPath,
      input.outputPath,
      String(input.maxSide),
      String(input.jpegQuality),
    ],
    { windowsHide: true, maxBuffer: 1024 * 1024 },
  );

  if (stderr.trim()) {
    throw new Error(`Image resize failed: ${stderr.trim() || stdout.trim()}`);
  }
}

function assertPathInside(filePath: string, dir: string): void {
  const normalizedDir = dir.endsWith(sep) ? dir : `${dir}${sep}`;
  if (!filePath.startsWith(normalizedDir)) {
    throw new Error(`Prepared image path escaped outputDir: ${filePath}`);
  }
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "") || "image";
}

function resizeScript(): string {
  return `
param(
  [string]$InputPath,
  [string]$OutputPath,
  [int]$MaxSide = 1280,
  [int]$Quality = 76
)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($InputPath)
try {
  $longSide = [Math]::Max($img.Width, $img.Height)
  $scale = if ($longSide -gt $MaxSide) { $MaxSide / $longSide } else { 1.0 }
  $newW = [Math]::Max(1, [int][Math]::Round($img.Width * $scale))
  $newH = [Math]::Max(1, [int][Math]::Round($img.Height * $scale))
  $bmp = New-Object System.Drawing.Bitmap $newW, $newH
  try {
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.DrawImage($img, 0, 0, $newW, $newH)
    } finally {
      $g.Dispose()
    }
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" } | Select-Object -First 1
    $encParams = New-Object System.Drawing.Imaging.EncoderParameters 1
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([int64]$Quality)
    $bmp.Save($OutputPath, $codec, $encParams)
  } finally {
    $bmp.Dispose()
  }
} finally {
  $img.Dispose()
}
`.trimStart();
}
