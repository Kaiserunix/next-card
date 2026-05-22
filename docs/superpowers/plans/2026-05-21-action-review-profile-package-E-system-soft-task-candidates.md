# 任务包 E：System Soft Task Candidate Generator 包

> **执行要求：** 本包只生成系统软任务候选，不提交 deck，不创建 card，不插入 schedule event，不发 reminder。

**目标：** 从 proof/profile/summary insight 生成低风险的系统软任务候选，并把所有候选交给 Time Guardian review。

**优先级：** P1

**依赖：** A、C、D；需要第二层 Time Guardian 合同稳定后再接入。

## 涉及文件

```text
lib/server/action-review/system-soft-task-candidates.ts
tests/server/action-review/system-soft-task-candidates.test.ts
```

## 必须实现的接口

```ts
generateSoftTaskCandidates(profile, proofInsights): SystemSoftTaskCandidate[]
```

## 允许生成的候选类型

```text
review task
recovery task
preparation task
continuation task
summary/reflection task
```

例子：

```text
复习今天冻结过的卡片上下文
为明早课程准备第一张启动卡
把已经完成的任务整理成 proof summary
继续上次燃烧后完成的任务后续检查
```

## 硬性规则

- `defaultTension` 必须是 `soft`。
- `requiresTimeGuardianReview` 必须是 `true`。
- 候选必须带 `evidenceIds`。
- 候选进入 deck library candidate 区，不进入 committed deck。
- Time Guardian 决定何时 surface。
- Time Guardian 之前，候选不得 mandatory。
- 候选文案不能羞辱用户。

## 禁止行为

```text
直接创建 committed deck
直接创建 active card
直接创建 reminder job
直接写 proof
直接改 deadline / TimeLock
把 soft candidate 标成 hard
跳过 A/B/C Plan Mode
绕过 Time Guardian review
```

## 验收标准

- 生成结果全部是 `SystemSoftTaskCandidate`。
- 每个 candidate 都要求 Time Guardian review。
- 没有证据时不生成个性化 candidate，只能返回空数组或通用 future hint。
- 用户禁用 personalization 时，不生成 profile-based candidate。
- 连续 burn/freeze 只能生成 recovery candidate，不能生成责备文案。

## 验证命令

```powershell
pnpm test tests/server/action-review/system-soft-task-candidates.test.ts
pnpm typecheck
```

如果当前项目没有 `typecheck` 脚本，改用：

```powershell
pnpm exec tsc --noEmit --incremental false
```

## 建议提交

```powershell
git add lib/server/action-review/system-soft-task-candidates.ts tests/server/action-review/system-soft-task-candidates.test.ts
git commit -m "feat: add system soft task candidates"
```
