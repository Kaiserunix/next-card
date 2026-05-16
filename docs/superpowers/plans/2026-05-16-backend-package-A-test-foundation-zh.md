# 任务包 A：测试基建包

> **执行要求：** 先完成本包，再推进其他后端测试包。本包只建立测试环境，不改产品业务逻辑。

**目标：** 给 Next Card 加上可跑的单元测试环境，让后续 mock AI、store、持久化和时间逻辑都可以 TDD。

**优先级：** P0

**依赖：** 无

**涉及文件：**

```text
package.json
pnpm-lock.yaml
vitest.config.ts
tests/setup.ts
```

## 具体任务

- 安装 `vitest` 和 `jsdom`。
- 在 `package.json` 新增：

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

- 新增 `vitest.config.ts`：
  - 使用 `jsdom` 环境。
  - 配置 `@` alias 指向项目根目录。
  - include `tests/**/*.test.ts` 和 `tests/**/*.test.tsx`。

- 新增 `tests/setup.ts`：
  - 每个测试后清理 `localStorage`。
  - 恢复 fake timers。
  - 清理 spies/mocks。

## 验收标准

- `pnpm test` 能正常启动。
- 测试环境能 import `@/lib/...` 和 `@/store/...`。
- jsdom 环境中 `localStorage` 可用。
- 没有引入真实 API 或 UI 逻辑改动。

## 验证命令

```bash
pnpm test
pnpm lint
```

## 建议提交

```bash
git add package.json pnpm-lock.yaml vitest.config.ts tests/setup.ts
git commit -m "test: add vitest foundation"
```
