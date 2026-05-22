# 任务包 C：PlanModeDraft Repository 包

> **执行要求：** 本包只实现 PlanModeDraft 的轻量 repository。不要生成计划，不要实现 route，不要写 deck/proof/reminder 状态。

**目标：** 保存 Plan Mode draft，支持 regeneration traceability 和未来 deck commit 引用。

**优先级：** P1

**依赖：** A

## 涉及文件

```text
lib/server/plan-mode/plan-mode-repository.ts
tests/server/plan-mode/plan-mode-repository.test.ts
.gitignore
.env.example
```

如果 `.gitignore` 尚未忽略 `.nextcard-data/`，本包负责补上。

## 必须实现的接口

```ts
interface PlanModeDraftRepository {
  saveDraft(draft: PlanModeDraft): Promise<PlanModeDraft>;
  getDraft(id: string): Promise<PlanModeDraft | null>;
  listDraftsByHandoff(verifiedInputBundleId: string): Promise<PlanModeDraft[]>;
}
```

默认实现：

```text
JsonFilePlanModeDraftRepository
```

默认文件：

```text
.nextcard-data/plan-mode-drafts.json
```

环境变量：

```text
NEXTCARD_PLAN_MODE_DRAFT_FILE=.nextcard-data/plan-mode-drafts.json
```

## 存储边界

Repository 只能保存：

```text
PlanModeDraft
```

不能保存：

```text
committed deck
active card
proof record
reminder job
Time Guardian queue action
profile snapshot
```

## 幂等规则

- `saveDraft` 按 `draft.id` upsert。
- 同一 id 第二次保存不能产生重复记录。
- `getDraft` 找不到时返回 `null`。
- `listDraftsByHandoff` 按 `createdAt` 升序或降序均可，但测试必须固定一种。

## 验收标准

- 能保存并读取 draft。
- upsert 不重复。
- 能按 `verifiedInputBundleId` 列出 drafts。
- 本地 JSON 路径可由 env 覆盖。
- repository 测试使用临时文件，不污染真实 `.nextcard-data`。

## 验证命令

```powershell
pnpm test tests/server/plan-mode/plan-mode-repository.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/plan-mode/plan-mode-repository.ts tests/server/plan-mode/plan-mode-repository.test.ts .gitignore .env.example
git commit -m "feat: persist plan mode drafts"
```
