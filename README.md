Next Card 是一个“把目标变成行动卡组”的 Web MVP。

它不是普通 Todo，也不是后台管理面板。用户打开后直接进入可用的 input / deck / proof 三段式体验：

input：输入一句目标、作业通知、课程表、附件或图片课表，系统先像 Codex Plan Mode 一样分析目标、时间约束和压力，再给出三种方案：急速、均衡、温和。

deck：用户选择方案后，系统把目标拆成一组已经细化好的行动卡。执行时不是列表，而是一张一张卡推进：显示预计时间、剩余窗口、紧急程度、燃烧/冻结/裂纹等状态；支持滑动完成、双击开始计时、三击进入快速燃烧、下滑查看进度或冻结任务。

proof：把行动结果变成证据。这里会记录完成、冻结、燃烧、奖励、重新安排等事件，展示彩色记录表、进度图、时间统计和一份可读的总结文档。

技术上，它是一个 Next.js 15 + TypeScript + Tailwind + Zustand + Framer Motion 项目。当前仓库已经不是纯前端静态页，而是带 app/api/backend/* API 路由和 lib/server/* 后端服务层的 backend-capable MVP。AI、导入解析、通知、日历、数据库等能力都要求通过 lib/server/backend-ports.ts 接入，前端保留 deterministic mock fallback。
