# Next Card Git / Codex Worktree 整理方案

> 日期：2026-05-22
> 当前目标：把 `nextcard` 从“旧前端混杂 + 后端大量新增 + 临时测试残留”的状态整理成可维护的后端 runtime 工作树。

## 1. 当前 Git 现场

当前分支：

```text
codex/backend-only-runtime-20260522
```

来源：

```text
从 codex/voice-backend-slice 新建，用于承接当前 backend-only runtime 整理工作。
```

远端：

```text
origin https://github.com/Kaiserunix/next-card.git
```

当前定位：

```text
这个软件当前不是完整可用前端产品，而是“后端模块 / hidden runtime / MiMo 测试服务基本跑通”的工程状态。
```

## 2. 当前脏文件分类

### A. 应保留并提交：后端 runtime 新增

这些是当前最有价值的主体：

```text
app/api/backend/plan-mode/
lib/server/action-review/
lib/server/input-layer/
lib/server/plan-mode/
lib/server/time-guardian/
lib/server/mimo-openai-client.ts
tests/server/action-review/
tests/server/input-layer/
tests/server/plan-mode/
tests/server/time-guardian/
tests/server/stress/
tests/server/timeline-complexity/
tests/api/backend/plan-mode-route.test.ts
```

建议提交名：

```text
feat: add backend hidden runtime services
```

### B. 应保留并提交：真实 MiMo 测试服务

```text
scripts/real-mimo-test-service.mjs
scripts/real-mimo-planmode-full-test.mjs
tests/scripts/real-mimo-test-service.test.ts
docs/real-mimo-test-service.md
```

建议提交名：

```text
feat: add real mimo test runner
```

### C. 应保留并提交：架构 / 执行包文档

```text
docs/superpowers/specs/
docs/superpowers/plans/
docs/superpowers/test-images/
docs/agent-runtime-architecture.md
docs/backend-long-run-test-report.md
docs/backend-real-usage-simulation-report.md
```

建议提交名：

```text
docs: add backend runtime and mimo execution plans
```

### D. 应单独审查：旧前端删除

当前有大量旧前端/状态/store/mock 删除：

```text
components/
store/useNextCardStore.ts
lib/mock-ai.ts
lib/types.ts
lib/card-time-engine.ts
lib/page-contracts.ts
lib/webview-contract.ts
tests/store/
tests/lib/
tests/e2e/
```

这可能符合“现在只相当于跑好了后端”的方向，但它是一个大破坏性变更。建议不要混进后端 runtime commit。

建议分支/提交名：

```text
refactor: remove obsolete frontend runtime
```

提交前必须确认：

- `app/page.tsx` 是否有最小 backend shell。
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

### E. 应恢复或单独确认：GitHub 治理文件删除

当前删除：

```text
.github/CODEOWNERS
.github/workflows/ci.yml
```

建议：**不要默认提交删除**。

原因：

- CODEOWNERS 和 CI 属于 repo 治理，不属于“删除旧前端垃圾”。
- 用户之前偏好公开仓库 + PR review。
- 即使产品当前后端-only，CI 仍然有价值。

建议处理：

```powershell
git restore -- .github/CODEOWNERS .github/workflows/ci.yml
```

如果确实要删，单独提交：

```text
chore: remove old github governance files
```

但不推荐。

### F. 已清理/忽略：临时产物

已删除根目录：

```text
tmp-*
```

已加入 `.gitignore`：

```text
tmp-*
```

继续忽略：

```text
.codex-*
.nextcard-data/
.env.local
```

## 3. 推荐提交顺序

### Commit 1：恢复治理文件

如果确认保留 GitHub 治理：

```powershell
git restore -- .github/CODEOWNERS .github/workflows/ci.yml
```

这一步不需要 commit，只是避免误删进入后续提交。

### Commit 2：后端 runtime 主体

```powershell
git add app/api/backend/plan-mode lib/server tests/server tests/api/backend/plan-mode-route.test.ts lib/server/backend-ports.ts
git commit -m "feat: add backend hidden runtime services"
```

### Commit 3：真实 MiMo 测试服务

```powershell
git add scripts/real-mimo-test-service.mjs scripts/real-mimo-planmode-full-test.mjs tests/scripts/real-mimo-test-service.test.ts docs/real-mimo-test-service.md package.json pnpm-lock.yaml .env.example .gitignore
git commit -m "feat: add real mimo test runner"
```

### Commit 4：架构与执行包文档

```powershell
git add docs/superpowers docs/agent-runtime-architecture.md docs/backend-long-run-test-report.md docs/backend-real-usage-simulation-report.md docs/AI-BEHAVIOR.md docs/backend-extension-boundaries.md AGENTS.md README.md
git commit -m "docs: document backend runtime execution plan"
```

### Commit 5：旧前端移除

只在确认当前分支就是 backend-only runtime 分支后执行：

```powershell
git add app/globals.css app/layout.tsx components store lib/mock-ai.ts lib/types.ts lib/card-time-engine.ts lib/page-contracts.ts lib/webview-contract.ts tests/store tests/lib tests/e2e tests/helpers tests/fixtures/timetables tests/fixtures/ai-expanded-cases.ts playwright.config.ts postcss.config.mjs tailwind.config.ts scripts/run-tests.mjs
git commit -m "refactor: remove obsolete frontend runtime"
```

注意：这一步会记录大量 deletion，必须单独提交。

## 4. 验证命令

每个阶段至少跑：

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

真实 MiMo smoke 不放进默认 gate：

```powershell
pnpm real:mimo -- --mode text --limit 1
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
```

## 5. Codex Worktree 整理方案

建议不要继续在一个目录里混所有任务。拆成 4 个长期工作树。

### 主整合树

```text
C:\Users\qwerf\Desktop\nextcard
branch: codex/backend-only-runtime-20260522
用途：集成后端 runtime，跑全量测试，生成最终 PR。
```

### MiMo 接入树

```powershell
git worktree add C:\Users\qwerf\Desktop\nextcard-worktrees\mimo-import -b codex/mimo-import-provider codex/backend-only-runtime-20260522
```

用途：

- 执行 package A/B/C。
- 图片预处理。
- `MimoMultimodalExtractor`。
- `/api/backend/import`。

### Deck / Proof 树

```powershell
git worktree add C:\Users\qwerf\Desktop\nextcard-worktrees\deck-proof -b codex/deck-proof-ledger codex/backend-only-runtime-20260522
```

用途：

- 执行 package D。
- Deck Commit。
- Proof Ledger。

### Orchestrator 树

```powershell
git worktree add C:\Users\qwerf\Desktop\nextcard-worktrees\orchestrator -b codex/backend-orchestrator codex/backend-only-runtime-20260522
```

用途：

- 执行 package E/F。
- 沙盒全链路。
- smoke/redteam/report。

### 前端重建树

暂时不创建。等后端闭环完成后再建：

```powershell
git worktree add C:\Users\qwerf\Desktop\nextcard-worktrees\frontend-v2 -b codex/frontend-v2-shell codex/backend-only-runtime-20260522
```

用途：

- 极简真实 UI。
- input / review / A-B-C / proof timeline。

## 6. 当前不建议做的事

- 不建议把所有 dirty files 一次性 commit。
- 不建议把 `.github` 删除混入后端 commit。
- 不建议现在恢复旧前端。
- 不建议继续在 `codex/voice-backend-slice` 名义下堆新后端。
- 不建议把真实 MiMo smoke 放进 CI 默认 gate。

## 7. 推荐下一步

1. 先确认是否恢复 `.github/CODEOWNERS` 和 `.github/workflows/ci.yml`。
2. 按提交顺序拆 commit。
3. 建 `nextcard-worktrees\mimo-import`，先执行 A/B/C。
4. A/B/C 合并回 `codex/backend-only-runtime-20260522` 后，再开 D/E。
