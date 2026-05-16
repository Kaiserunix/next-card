import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);

function quoteForCmd(value) {
  if (/^[A-Za-z0-9_./:\\=-]+$/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '\\"')}"`;
}

export function getTestCommands(testArgs) {
  if (testArgs.length > 0) {
    return [
      testArgs.some(isE2eTarget)
        ? ["exec", "playwright", "test", ...testArgs]
        : ["exec", "vitest", "run", ...testArgs]
    ];
  }

  return [
    ["exec", "vitest", "run"]
  ];
}

function run(commandArgs) {
  const result = process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", ["pnpm", ...commandArgs].map(quoteForCmd).join(" ")], {
        env: process.env,
        shell: false,
        stdio: "inherit"
      })
    : spawnSync("pnpm", commandArgs, {
        env: process.env,
        shell: false,
        stdio: "inherit"
      });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function isE2eTarget(value) {
  const normalized = value.replaceAll("\\", "/");

  return normalized.includes("tests/e2e/") || normalized.endsWith(".spec.ts");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const command of getTestCommands(args)) {
    run(command);
  }
}
