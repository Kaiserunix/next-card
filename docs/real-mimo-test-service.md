# Next Card Real MiMo Test Service

这个服务是 CLI 慢跑工具，不是网页平台。它用于真实调用 MiMo，逐步检查 Next Card 的输入理解、图片识别、Plan Mode 后端路由。

## 入口

```powershell
pnpm real:mimo -- --help
```

测试结果默认写入：

```text
.nextcard-data/mimo-test-runs/<timestamp>/
```

里面会有：

- `events.jsonl`：每个 case 的状态流水。
- `checkpoint.json`：最后一次运行进度。
- `report.json`：本轮汇总。
- `responses/*.json`：模型返回内容。
- `prepared-images/*.jpg`：图片压缩后的发送版本。

`.nextcard-data/` 已在 `.gitignore`，不会提交。

## 常用命令

文本真实 smoke：

```powershell
pnpm real:mimo -- --mode text --limit 1
```

跑一张真实课表图片：

```powershell
pnpm real:mimo -- --mode image --image "C:\Users\qwerf\Downloads\66aa4560bbb1fd0251f0ac99bd42c845.jpg" --limit 1
```

慢跑生成图目录，先跑 5 张：

```powershell
pnpm real:mimo -- --mode image --image-dir "C:\Users\qwerf\.codex\generated_images\019e4957-65a1-7460-b2ae-a705d832703d" --limit 5 --delay-ms 1500 --timeout-ms 180000
```

继续上一次：

```powershell
pnpm real:mimo -- --mode image --image-dir "C:\Users\qwerf\.codex\generated_images\019e4957-65a1-7460-b2ae-a705d832703d" --resume latest --limit 10 --delay-ms 1500 --timeout-ms 180000
```

如果要测后端路由，先开 Next：

```powershell
pnpm exec next dev -H 127.0.0.1 -p 3022
```

然后另一个终端跑：

```powershell
pnpm real:mimo -- --mode route --route-url "http://127.0.0.1:3022/api/backend/plan-mode" --limit 1
```

汇总最近一次运行：

```powershell
pnpm real:mimo -- --summarize latest
```

这会读取 `events.jsonl`，输出并写入 `summary.json`：

- `ok / failed / skipped`
- timeout count
- non-json count
- schema-invalid count
- image `sourceKind` 分布
- extracted events / times / locations totals

导出可提交的脱敏 fixture：

```powershell
pnpm real:mimo -- --export-fixtures latest
```

导出位置：

```text
.nextcard-data/mimo-test-runs/<run>/exported-fixtures/
```

导出文件只保留 `id`、`model`、`parsed` 和 `contentLength`。不会包含 token、原始 data URL 或模型原文 `content`。

## 设计边界

- 工具读取 `.env.local` 里的 `MIMO_API_KEY`，但不会打印 token。
- 文本模式用 `mimo-v2.5-pro`。
- 图片模式用 `mimo-v2.5`。
- 大 PNG 默认会被压缩成 JPEG 再发送，避免 data URL 太大导致超时。
- 图片、PDF 截图、课程表、通知等都按高风险来源处理，提示模型输出 `needsStrictReview: true`。
- 这是测试服务，不写正式 deck、proof、reminder、profile。
- `--summarize` 和 `--export-fixtures` 不需要 `MIMO_API_KEY`，只读取已有运行目录。

## 新对话接力提示

可以把这段发给新对话：

```text
在 C:\Users\qwerf\Desktop\nextcard 继续跑真实 MiMo 测试服务。
先看 docs/real-mimo-test-service.md。
用 pnpm real:mimo -- --mode image --image-dir "C:\Users\qwerf\.codex\generated_images\019e4957-65a1-7460-b2ae-a705d832703d" --resume latest --limit 10 --delay-ms 1500 --timeout-ms 180000 慢慢跑。
每轮结束后读 .nextcard-data/mimo-test-runs/latest 对应目录里的 report.json 和 events.jsonl，总结识别是否成功、哪些图片超时、哪些返回不是 JSON、课程表时间/地点有没有抽出来。
不要重建网页平台。
```
