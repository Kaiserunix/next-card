# 任务包 K：CI 包

> **执行要求：** 先把单元测试和 build 接入 CI。Playwright 可以等 UI 稳定后再进默认 CI。

**目标：** 给后端测试建立自动回归门禁。

**优先级：** P1

**依赖：** 至少完成任务包 A-F

**涉及文件：**

```text
.github/workflows/ci.yml
README.md
```

## CI 应运行

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm build
```

## 建议暂不默认跑 Playwright

原因：

- UI 设计还在同事手里。
- selector 和动画可能还会变。
- 当前最需要稳定的是 mock AI、store、持久化和 build。

等 UI 稳定后再加：

```bash
pnpm test:e2e
```

## GitHub Actions 建议

- 触发条件：
  - pull_request
  - push main

- Node 版本：
  - Node 22

- 包管理：
  - pnpm

## README 更新

把交付前检查更新为：

```bash
pnpm lint
pnpm test
pnpm build
```

并说明：

```text
Vitest 覆盖本地后端状态机和 mock AI 合同；Playwright 只用于少量移动端 WebView 冒烟测试。
```

## 验收标准

- PR 和 main push 都会跑 CI。
- lint/test/build 任一失败则 CI 失败。
- 不因为 UI e2e 暂时不稳定阻断后端开发。

## 验证命令

```bash
pnpm lint
pnpm test
pnpm build
```

## 建议提交

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: verify lint tests and build"
```
