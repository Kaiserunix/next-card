import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve as resolvePath, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const withoutAlias = specifier.slice(2);
    const base = resolvePath(process.cwd(), withoutAlias);
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.mjs`,
      `${base}.json`,
      join(base, "index.ts"),
    ];
    const match = candidates.find((candidate) => existsSync(candidate));
    if (match) {
      return nextResolve(pathToFileURL(match).href, context);
    }
  }

  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
    const base = resolvePath(fileURLToPath(new URL(specifier, context.parentURL)));
    const match = findModuleCandidate(base);
    if (match) {
      return nextResolve(pathToFileURL(match).href, context);
    }
  }

  return nextResolve(specifier, context);
}

function findModuleCandidate(base) {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.json`,
    join(base, "index.ts"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const source = await readFile(new URL(url), "utf8");
    const output = ts.transpileModule(source, {
      fileName: new URL(url).pathname,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
      },
    });
    return {
      format: "module",
      source: output.outputText,
      shortCircuit: true,
    };
  }

  return nextLoad(url, context);
}
