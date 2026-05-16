"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FilePlus2, ImagePlus, Loader2, Menu, Send, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNextCardStore } from "@/store/useNextCardStore";

const examples = ["去高数课", "今晚 20:00 前交一页课程分析", "把明天早八课表变成提醒卡"];

export function InputComposer() {
  const {
    inputs,
    analysisStatus,
    setInputText,
    addMockAttachment,
    addMockImageSchedule,
    analyzeInput,
    finishAnalysis
  } = useNextCardStore();
  const [submittedText, setSubmittedText] = useState("");

  const canSubmit = useMemo(
    () => Boolean(inputs.text.trim() || inputs.attachments.length > 0 || inputs.imageSchedule),
    [inputs]
  );

  useEffect(() => {
    if (analysisStatus !== "analyzing") {
      return;
    }

    const timer = window.setTimeout(() => {
      finishAnalysis();
    }, 880);

    return () => window.clearTimeout(timer);
  }, [analysisStatus, finishAnalysis]);

  const handleSubmit = () => {
    if (!canSubmit || analysisStatus === "analyzing") {
      return;
    }

    setSubmittedText(inputs.text.trim() || inputs.parsedText || "模拟图像课表");
    analyzeInput();
  };

  return (
    <section className="phone-shell grain flex min-h-[calc(100svh-6.75rem)] w-full flex-col px-4 pb-4 pt-4">
      <div className="relative z-10 flex items-center justify-between px-1">
        <button
          type="button"
          className="grid size-8 place-items-center rounded-full bg-[#ece5d7] text-ink transition hover:scale-95"
          aria-label="menu"
        >
          <Menu size={15} />
        </button>
        <div className="text-sm font-medium tracking-[0.01em] text-ink">Input chat</div>
        <button
          type="button"
          className="grid size-8 place-items-center rounded-full bg-[#ece5d7] text-ink transition hover:scale-95"
          aria-label="audio"
        >
          <Volume2 size={15} />
        </button>
      </div>

      <div className="relative z-10 mt-8 flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {!submittedText && analysisStatus === "idle" ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5"
            >
              <div className="font-editorial text-[2rem] leading-[1.08] text-ink">
                把一句目标，
                <br />
                变成下一张可执行卡。
              </div>
              <p className="max-w-[18rem] text-[0.92rem] leading-6 text-ink/70">
                发来一句话、作业通知、课表文字，或模拟图片课表。我会先理解，再给三套执行方案。
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setInputText(example)}
                    className="rounded-full border border-ink/10 bg-white/55 px-3 py-2 text-xs text-ink/76 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="conversation"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="ml-auto max-w-[17rem] rounded-[1.35rem] bg-[#f0e7d8] px-4 py-3 text-[0.96rem] leading-6 text-ink shadow-sm">
                {submittedText || inputs.text || "等待输入"}
              </div>

              <div className="max-w-[18.5rem] rounded-[1.35rem] border border-ink/8 bg-white/56 px-4 py-3 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-fern">
                  {analysisStatus === "analyzing" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {analysisStatus === "analyzing" ? "understanding" : "ready"}
                </div>
                <p className="text-[0.95rem] leading-6 text-ink/78">
                  {analysisStatus === "analyzing"
                    ? "我正在先读目标、找时间线、判断是否需要燃烧或冻结路径。"
                    : "理解完成。下方会出现目标理解、约束、阶段拆解和三套执行方案。"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative z-10 space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addMockAttachment}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-ink/10 bg-white/58 text-xs font-medium text-ink/78 transition hover:bg-white"
          >
            <FilePlus2 size={15} />
            模拟附件
          </button>
          <button
            type="button"
            onClick={addMockImageSchedule}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-ink/10 bg-white/58 text-xs font-medium text-ink/78 transition hover:bg-white"
          >
            <ImagePlus size={15} />
            图像课表
          </button>
        </div>

        {(inputs.attachments.length > 0 || inputs.imageSchedule) && (
          <div className="rounded-[1rem] border border-ink/8 bg-white/45 px-3 py-2 text-xs leading-5 text-ink/62">
            {inputs.attachments.length > 0 && <div>已加入 {inputs.attachments.length} 个模拟附件</div>}
            {inputs.imageSchedule && <div>已解析模拟图片课表：明天 08:00 高数课</div>}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-[1.7rem] border border-ink/10 bg-white/82 p-2 shadow-sm">
          <textarea
            value={inputs.text}
            onChange={(event) => setInputText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                handleSubmit();
              }
            }}
            placeholder="What's your next card?"
            className="min-h-12 flex-1 bg-transparent px-2 py-2 text-[0.95rem] leading-5 text-ink outline-none placeholder:text-ink/34"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || analysisStatus === "analyzing"}
            className="mb-0.5 flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-white transition hover:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink/26"
          >
            <span>生成执行方案</span>
            <Send size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
