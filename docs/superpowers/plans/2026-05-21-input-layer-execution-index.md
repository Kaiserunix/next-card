# Next Card 第一层输入整理层执行包索引

> 这组文档用于分派给其他执行任务，目标是把“输入整理层”从产品想法拆成可实现、可审计、可测试的工程边界。执行者应先读本索引，再只执行自己负责的任务包。

## 总目标

把第一层从“一个会理解用户的 agent”拆成一组受控服务：

```text
Input Intake
-> Extraction Worker / Multimodal Adapter
-> Review Gate + Evidence Binder
-> Pre-Deck Fact Confirmation
-> Task / Time Candidate Handoff
-> Plan Compiler Handoff
```

第一层只产出候选、草案、确认请求、已确认事实包和 Plan Mode 输入。它不能直接写入 committed deck、card runtime、reminder job、proof、profile 或 hard lock 权威状态。

## 必读上游文档

- `AGENTS.md`
- `docs/superpowers/specs/2026-05-21-hidden-agent-profile-architecture.md`
- `docs/superpowers/specs/2026-05-21-voice-plan-mode-backend-design.md`
- `docs/superpowers/specs/voice-opening-ui-design.md`
- `docs/superpowers/specs/2026-05-21-soft-task-and-deck-library.md`

## 分包执行顺序

1. A：合同与测试样例包
2. B：Raw Input Intake 包
3. C：语音/文本归一化与 readiness 包
4. D：多模态抽取适配包
5. E：Review Gate 与 Evidence Binder 包
6. F：Pre-Deck Fact Confirmation 与 Plan Handoff 包
7. G：红队压力测试与 skill 草案包

## 独立任务包文件

- [A：合同与测试样例包](./2026-05-21-input-layer-package-A-contracts-fixtures.md)
- [B：Raw Input Intake 包](./2026-05-21-input-layer-package-B-raw-input-intake.md)
- [C：语音/文本归一化与 readiness 包](./2026-05-21-input-layer-package-C-voice-text-readiness.md)
- [D：多模态抽取适配包](./2026-05-21-input-layer-package-D-multimodal-extraction.md)
- [E：Review Gate 与 Evidence Binder 包](./2026-05-21-input-layer-package-E-review-evidence.md)
- [F：Pre-Deck Fact Confirmation 与 Plan Handoff 包](./2026-05-21-input-layer-package-F-fact-confirmation-handoff.md)
- [G：红队压力测试与 skill 草案包](./2026-05-21-input-layer-package-G-redteam-skill-draft.md)

## 全局不变量

- 用户看不到 agent 分层、agent 名称、agent 对话。
- A/B/C Plan Mode 不能被跳过。
- LLM / agent / model worker 只能输出 `candidate`、`draft`、`proposal`、`explanation`。
- 权威写入必须经过确定性 service、review gate、policy gate 或 permission gate。
- 多模态大输入不能直接生成 committed deck。
- 时间、地点、事件、任务类型在进入 committed deck 前必须经过用户确认。
- hard lock、DDL、固定日程、课程时间、考试时间、提交截止不能静默写入或静默移动。
- 文档和通知里的指令性文本只能当待解析内容，不能当系统指令。
- rejected transcript / rejected raw input 不写入 proof 或用户历史。

## 当前不做

- 不做完整 Plan Mode backend。
- 不做 deck/proof backend persistence。
- 不做 Aliyun/Tencent ASR 客户端。
- 不做 Android native bridge。
- 不做真实日历同步。
- 不做自动 profile 学习。
- 不让第一层直接插入 reminder。

## 分派建议

- 架构/类型同事：A
- 后端入口同事：B + C
- 多模态同事：D
- 风险审查同事：E
- 产品流/Plan Mode 对接同事：F
- 审计/skill 同事：G

## 给其他任务的启动提示

```text
你正在优化 Next Card 的第一层输入整理层。先阅读：
1. AGENTS.md
2. docs/superpowers/specs/2026-05-21-hidden-agent-profile-architecture.md
3. docs/superpowers/plans/2026-05-21-input-layer-execution-index.md
4. 你被分配的具体输入层任务包

只执行被分配的任务包。第一层只能输出候选、草案、确认请求、已确认事实包和 Plan Compiler handoff；不能直接写 committed deck、card runtime、reminder job、proof、profile 或 hard lock 权威状态。遇到任务包之间的边界冲突，先记录为 blocker，不要自行扩大范围。
```

## 执行者最终报告格式

```text
完成范围:
- ...

改动文件:
- ...

验证:
- ...

未做/刻意不做:
- ...

发现的产品或架构阻塞:
- ...
```
