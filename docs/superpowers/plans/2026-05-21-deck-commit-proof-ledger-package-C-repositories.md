# 任务包 C：DeckStore / CardRuntimeStore Repository 包

> **执行要求：** 本包只实现 committed deck、initial card runtime、commit audit 的本地 JSON repository。不要生成 cards，不要 append proof，不要做 route，不要写 Time Guardian。

**目标：** 为 P0 提供确定性本地持久化，支撑 deck commit 幂等、commit audit 和 card 初始状态查询。

**优先级：** P0

**依赖：** A、B。

## 涉及文件

```text
lib/server/deck-commit/deck-repository.ts
lib/server/deck-commit/card-runtime-repository.ts
lib/server/deck-commit/commit-audit-repository.ts
lib/server/deck-commit/json-file-store.ts
tests/server/deck-commit/deck-repository.test.ts
tests/server/deck-commit/card-runtime-repository.test.ts
tests/server/deck-commit/commit-audit-repository.test.ts
```

P0 本地数据路径：

```text
.nextcard-data/deck-store.json
.nextcard-data/card-runtime-store.json
.nextcard-data/deck-commit-audit.json
```

## 必须实现的接口

```ts
interface DeckRepository {
  saveDeck(deck: CommittedDeck): Promise<CommittedDeck>;
  getDeck(id: string): Promise<CommittedDeck | null>;
  listDecksByScope(scope: DeckScope): Promise<CommittedDeck[]>;
}

interface CardRuntimeRepository {
  saveCards(cards: CommittedCard[]): Promise<CommittedCard[]>;
  listCardsByDeck(deckId: string): Promise<CommittedCard[]>;
  getCard(id: string): Promise<CommittedCard | null>;
}

interface DeckCommitAuditRepository {
  saveAudit(audit: DeckCommitAudit): Promise<DeckCommitAudit>;
  findByIdempotencyKey(idempotencyKey: string): Promise<DeckCommitAudit | null>;
  findByPlanModeDraftId(planModeDraftId: string): Promise<DeckCommitAudit[]>;
}
```

## Repository 规则

- `saveDeck` 不允许覆盖不同 version 的同 id deck。
- `saveCards` 必须保证所有 cards 的 `deckId` 一致且非空。
- card 初始状态只能是 `queued` 或 `needs-review`。
- repository 不写 proof request outbox。
- repository 不写 reminder job。
- repository 不写 schedule snapshot。
- repository 不写 profile/policy。
- JSON 文件缺失时返回空集合并在首次保存时创建。

## 测试重点

- 保存并读取 committed deck。
- 保存并按 deck 读取 cards。
- 保存并通过 `idempotencyKey` 读取 commit audit。
- 同 id 不同 version 覆盖被拒绝。
- 空 JSON 文件路径能初始化。
- repository 序列化后不含 `ProofEvent`、`ReminderPlan`、`TimeLock`、`ProfileSnapshot`。

## 验收标准

- 本包只负责本地 JSON repository。
- 所有写入都有明确 scope 或 id。
- commit audit 可支撑 B 包的 replay/conflict 判断。
- deck/card repository 可支撑 G 包 API 返回。

## 验证命令

```powershell
pnpm test tests/server/deck-commit/deck-repository.test.ts tests/server/deck-commit/card-runtime-repository.test.ts tests/server/deck-commit/commit-audit-repository.test.ts
pnpm typecheck
```

## 建议提交

```powershell
git add lib/server/deck-commit/deck-repository.ts lib/server/deck-commit/card-runtime-repository.ts lib/server/deck-commit/commit-audit-repository.ts lib/server/deck-commit/json-file-store.ts tests/server/deck-commit/*repository.test.ts
git commit -m "feat: add deck commit repositories"
```
