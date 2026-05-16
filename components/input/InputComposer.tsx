"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, FilePlus2, ImagePlus, Layers3, Menu, RotateCcw, Send, Volume2 } from "lucide-react";
import { useMemo } from "react";
import { PlanCatalogPreview } from "@/components/PlanCatalogPreview";
import { useNextCardStore } from "@/store/useNextCardStore";

const examples = ["去高数课", "今晚 20:00 前交一页课程分析", "把明天早八课表变成提醒卡"];

export function InputComposer() {
  const {
    inputs,
    analysis,
    taskFlow,
    deck,
    plans,
    setInputText,
    addMockAttachment,
    addMockImageSchedule,
    submitGoalAndCreateDeck,
    resetInputDraft,
    openDeck,
    selectPlan,
    openPlanCatalog,
    openOverlay
  } = useNextCardStore();

  const canSubmit = useMemo(
    () => Boolean(inputs.text.trim() || inputs.attachments.length > 0 || inputs.imageSchedule),
    [inputs]
  );
  const activeDeck = deck.decks.find((item) => item.id === deck.activeDeckId);
  const hasResult = Boolean(taskFlow && analysis && activeDeck);
  const selectedPlan = plans.options.find((option) => option.id === plans.selectedPlanId) ?? plans.options[0];

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    submitGoalAndCreateDeck();
  };

  return (
    <section className="phone-shell grain flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pb-4 pt-4">
      <div className="relative z-10 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => openOverlay("guide")}
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

      <div className="relative z-10 mt-5 min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {!hasResult ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex h-full flex-col"
            >
              <div className="font-editorial text-[1.92rem] leading-[1.08] text-ink">
                把一句目标，
                <br />
                直接拆成行动卡。
              </div>
              <p className="mt-4 max-w-[19rem] text-[0.9rem] leading-6 text-ink/70">
                输入目标后直接生成初步分解任务，不再进入长计划页面。
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
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
              <div className="mt-auto grid grid-cols-3 gap-2 pb-1">
                {["理解目标", "拆小任务", "生成卡组"].map((item) => (
                  <div key={item} className="rounded-[1rem] bg-white/52 px-3 py-3 text-center text-xs font-semibold text-ink/58">
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex h-full min-h-0 flex-col"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-fern">
                    <Layers3 size={14} />
                    初步分解任务
                  </div>
                  <h1 className="mt-2 truncate font-editorial text-[1.78rem] leading-tight text-ink">
                    {taskFlow?.title}
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={resetInputDraft}
                  className="grid size-9 shrink-0 place-items-center rounded-full border border-ink/10 bg-white/62 text-ink"
                  aria-label="重新输入"
                >
                  <RotateCcw size={15} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1 rounded-full border border-ink/10 bg-white/60 p-1">
                {plans.options.map((option, index) => {
                  const selected = plans.selectedPlanId === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => selectPlan(option.id)}
                      className={`h-8 rounded-full text-xs font-semibold transition ${
                        selected ? "bg-ink text-white shadow-sm" : "text-ink/58 hover:bg-white/72"
                      }`}
                      aria-pressed={selected}
                    >
                      方案{["一", "二", "三"][index]}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 min-h-0 flex-1 overflow-hidden">
                <PlanCatalogPreview
                  taskFlow={taskFlow}
                  deck={activeDeck}
                  selectedPlan={selectedPlan}
                  compact
                  onOpen={openPlanCatalog}
                  onNodeOpen={(nodeId) => openOverlay("task-node-detail", nodeId)}
                />
              </div>

              {activeDeck && (
                <button
                  type="button"
                  onClick={() => openDeck(activeDeck.id)}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white shadow-[0_14px_28px_rgba(6,63,39,0.18)]"
                >
                  进入 deck
                  <ArrowRight size={16} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!hasResult && (
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
              disabled={!canSubmit}
              className="mb-0.5 flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-white transition hover:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink/26"
            >
              <span>直接拆解</span>
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
