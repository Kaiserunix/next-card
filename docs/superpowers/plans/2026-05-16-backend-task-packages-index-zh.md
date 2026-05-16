# Next Card 后端任务包索引

> 这个索引把后端任务包拆成独立文件，方便分给不同同事或拆成多个 issue。总览文档仍保留在 `2026-05-16-backend-task-packages-zh.md`。

## 推荐执行顺序

1. A：测试基建包
2. B：Mock AI 合同测试包
3. C：Store 测试工具包
4. D：Planning 状态机测试包
5. E：Deck 行为状态机测试包
6. F：localStorage 持久化测试包
7. G：Card Time Engine 时间引擎包
8. H：冻结恢复队列包
9. I：Proof 语义收敛包
10. K：CI 包
11. J：Playwright MVP 冒烟包
12. L：真实后端扩展边界包

## 独立任务包文件

- [A：测试基建包](./2026-05-16-backend-package-A-test-foundation-zh.md)
- [B：Mock AI 合同测试包](./2026-05-16-backend-package-B-mock-ai-contract-zh.md)
- [C：Store 测试工具包](./2026-05-16-backend-package-C-store-test-helpers-zh.md)
- [D：Planning 状态机测试包](./2026-05-16-backend-package-D-planning-store-flow-zh.md)
- [E：Deck 行为状态机测试包](./2026-05-16-backend-package-E-deck-actions-zh.md)
- [F：localStorage 持久化测试包](./2026-05-16-backend-package-F-persistence-zh.md)
- [G：Card Time Engine 时间引擎包](./2026-05-16-backend-package-G-card-time-engine-zh.md)
- [H：冻结恢复队列包](./2026-05-16-backend-package-H-reschedule-queue-zh.md)
- [I：Proof 语义收敛包](./2026-05-16-backend-package-I-proof-semantics-zh.md)
- [J：Playwright MVP 冒烟包](./2026-05-16-backend-package-J-playwright-smoke-zh.md)
- [K：CI 包](./2026-05-16-backend-package-K-ci-zh.md)
- [L：真实后端扩展边界包](./2026-05-16-backend-package-L-extension-boundaries-zh.md)

## 建议分派

- 后端同事 1：A + B
- 后端同事 2：C + D + E
- 后端同事 3：G + H + I
- 工程化同事：F + K + L
- UI/QA 同事：J

## 当前不要做

- 不接真实 OCR。
- 不接真实 OpenAI API。
- 不接真实数据库。
- 不做登录。
- 不做日历同步。
- 不做推送通知。
- 不做 Android 原生 WebView bridge。
