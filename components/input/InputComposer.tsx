"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BookOpen, CheckCircle2, Menu, RotateCcw, Send } from "lucide-react";
import { useMemo } from "react";
import { useNextCardStore } from "@/store/useNextCardStore";

const examples = ["去高数课", "今晚 20:00 前交一页课程分析", "把明天早八课表变成提醒卡"];
const planLabels = ["快速", "稳妥", "低压"];

export function InputComposer() {
  const {
    inputs,
    analysis,
    taskFlow,
    deck,
    plans,
    setInputText,
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
  const recommendedCard = activeDeck?.cards.find((card) => card.id === deck.currentCardId) ??
    activeDeck?.cards.find((card) => card.status === "active") ??
    activeDeck?.cards.find((card) => card.status === "queued") ??
    activeDeck?.cards[0];
  const hasResult = Boolean(taskFlow && analysis && activeDeck);
  const selectedPlan = plans.options.find((option) => option.id === plans.selectedPlanId) ?? plans.options[0];
  const progress = activeDeck && activeDeck.totalCards > 0
    ? Math.round((activeDeck.completedCards / activeDeck.totalCards) * 100)
    : taskFlow?.overallProgress ?? 0;

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
        <div className="text-sm font-medium tracking-[0.01em] text-ink">Next Card</div>
        <span className="size-8" aria-hidden />
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
                现在，
                <br />
                只做一张卡。
              </div>
              <p className="mt-4 max-w-[18rem] text-[0.9rem] leading-6 text-ink/64">
                输入目标，马上得到第一步。
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
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex h-full min-h-0 flex-col"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fern">推荐行动</div>
                  <h1 className="mt-1 truncate font-editorial text-[1.72rem] leading-tight text-ink">
                    {recommendedCard?.title ?? taskFlow?.title}
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
                      {planLabels[index] ?? option.name}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 min-h-0 flex-1 overflow-hidden">
                <RecommendedCard
                  title={recommendedCard?.title ?? "先做第一步"}
                  action={recommendedCard?.action ?? selectedPlan?.summary ?? "先完成一个 10 分钟内能做的小动作。"}
                  minutes={recommendedCard?.estimatedMinutes ?? 10}
                  progress={progress}
                  onOpenPlan={openPlanCatalog}
                />
              </div>

              {activeDeck && (
                <button
                  type="button"
                  onClick={() => openDeck(activeDeck.id)}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white shadow-[0_14px_28px_rgba(6,63,39,0.18)]"
                >
                  开始行动
                  <ArrowRight size={16} />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!hasResult && (
        <div className="relative z-10">
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
              <span>生成</span>
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function RecommendedCard({
  title,
  action,
  minutes,
  progress,
  onOpenPlan
}: {
  title: string;
  action: string;
  minutes: number;
  progress: number;
  onOpenPlan: () => void;
}) {
  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.5rem] border border-ink/10 bg-[#fff8f1] p-4 shadow-card">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-ink/56">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 size={14} />
          第一张卡
        </span>
        <span>{minutes} 分钟</span>
      </div>
      <h2 className="mt-5 font-editorial text-[2rem] leading-tight text-ink">{title}</h2>
      <p className="mt-3 line-clamp-3 text-[0.95rem] leading-7 text-ink/68">{action}</p>
      <div className="mt-auto">
        <div className="flex items-center justify-between text-xs font-semibold text-ink/52">
          <span>计划进度</span>
          <span>{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/8">
          <div className="h-full rounded-full bg-moss" style={{ width: `${progress}%` }} />
        </div>
        <button
          type="button"
          onClick={onOpenPlan}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-ink/10 bg-white/68 text-sm font-semibold text-ink"
        >
          <BookOpen size={15} />
          查看计划
        </button>
      </div>
    </article>
  );
}
