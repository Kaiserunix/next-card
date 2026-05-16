"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Flame, Snowflake } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TaskCard, TaskDeck } from "@/lib/types";
import { useNextCardStore } from "@/store/useNextCardStore";
import { CardTimeUI } from "@/components/deck/CardTimeUI";
import { DeckStatusBar } from "@/components/deck/DeckStatusBar";
import { FreezePrompt } from "@/components/deck/FreezePrompt";

type SwipeTaskCardProps = {
  deck: TaskDeck;
  card: TaskCard;
  focus?: boolean;
};

export function SwipeTaskCard({ deck, card, focus = false }: SwipeTaskCardProps) {
  const activeTimeMode = useNextCardStore((state) => state.deck.activeTimeMode);
  const completeCurrentCard = useNextCardStore((state) => state.completeCurrentCard);
  const continueCurrentCard = useNextCardStore((state) => state.continueCurrentCard);
  const freezeCurrentCard = useNextCardStore((state) => state.freezeCurrentCard);
  const startFocusTiming = useNextCardStore((state) => state.startFocusTiming);
  const startQuickBurning = useNextCardStore((state) => state.startQuickBurning);
  const [showStatus, setShowStatus] = useState(false);
  const [showFreeze, setShowFreeze] = useState(false);
  const [sparks, setSparks] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const elapsedSeconds = useMemo(() => {
    if (!card.startedAt) {
      return card.elapsedSeconds;
    }

    return card.elapsedSeconds + Math.max(0, Math.floor((now - new Date(card.startedAt).getTime()) / 1000));
  }, [card.elapsedSeconds, card.startedAt, now]);

  const playFlint = () => {
    try {
      const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
      const AudioContextClass = window.AudioContext || audioWindow.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(760, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(180, context.currentTime + 0.08);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.11);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
    } catch {
      // Visual sparks are the graceful fallback when WebAudio is blocked.
    }
  };

  const handleDoubleClick = () => {
    setSparks((value) => value + 1);
    playFlint();
    startFocusTiming();
  };

  const handleClick = (detail: number) => {
    if (detail >= 3) {
      setSparks((value) => value + 1);
      startQuickBurning();
    }
  };

  return (
    <div className={focus ? "relative flex h-full min-h-0 flex-col overflow-hidden" : "space-y-3"}>
      <AnimatePresence>
        {showStatus && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={focus ? "absolute inset-x-1 top-1 z-20" : undefined}
          >
            <DeckStatusBar deck={deck} card={card} elapsedSeconds={elapsedSeconds} />
          </motion.div>
        )}
        {showFreeze && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={focus ? "absolute inset-x-1 top-1 z-20" : undefined}
          >
            <FreezePrompt
              onContinue={() => {
                setShowFreeze(false);
                continueCurrentCard();
              }}
              onFreeze={() => {
                setShowFreeze(false);
                freezeCurrentCard();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.article
        key={card.id}
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          if (info.offset.x > 78) {
            completeCurrentCard("right");
            return;
          }

          if (info.offset.x < -78) {
            completeCurrentCard("left");
            return;
          }

          if (info.offset.y > 128) {
            setShowFreeze(true);
            return;
          }

          if (info.offset.y > 54) {
            setShowStatus((value) => !value);
          }
        }}
        onDoubleClick={handleDoubleClick}
        onClick={(event) => handleClick(event.detail)}
        whileTap={{ scale: 0.985 }}
        className={`relative overflow-hidden rounded-[1.8rem] border shadow-card ${
          focus ? "flex min-h-0 flex-1 flex-col p-4" : "p-5"
        } ${
          card.damageEffect === "freeze"
            ? "border-sky-200 bg-[#eefbff]"
            : card.damageEffect === "burn" || activeTimeMode === "burning"
              ? "border-ember/24 bg-[#fff3ea]"
              : "border-ink/10 bg-[#fff8f1]"
        }`}
      >
        {(card.damageEffect === "burn" || activeTimeMode === "burning") && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-2 burn-rail" />
            <div className="pointer-events-none absolute inset-y-8 right-0 w-1 rounded-l-full bg-ember/45 blur-[1px]" />
          </>
        )}

        <SparkLayer seed={sparks} active={activeTimeMode === "burning" || sparks > 0} />
        <CardTimeUI card={{ ...card, elapsedSeconds }} />
        <div className={`${focus ? "mt-5" : "mt-5"} flex items-start justify-between gap-3`}>
          <h3
            className={`min-w-0 overflow-hidden font-editorial leading-tight text-ink ${
              focus ? "max-h-[5rem] text-[2rem]" : "text-[1.85rem]"
            }`}
          >
            {card.title}
          </h3>
          <span className="shrink-0 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-ink/64">
            {deck.completedCards + 1} / {deck.totalCards}
          </span>
        </div>
        <p className={`${focus ? "line-clamp-2" : ""} mt-4 text-[0.98rem] leading-7 text-ink/70`}>
          {card.action}
        </p>
        <div className="mt-auto" />

        <div className={`${focus ? "mt-4" : "mt-5"} grid grid-cols-[1fr_3rem_3rem] gap-2`}>
          <button
            type="button"
            onClick={() => completeCurrentCard("left")}
            className={`${focus ? "h-11" : "h-11"} flex items-center justify-center gap-1.5 rounded-full bg-ink text-sm font-semibold text-white`}
          >
            <CheckCircle2 size={16} />
            完成
          </button>
          <button
            type="button"
            onClick={() => startQuickBurning()}
            className={`${focus ? "h-11" : "h-11"} grid place-items-center rounded-full border border-ember/20 bg-[#fff0e8] text-ember`}
            aria-label="快速燃烧"
          >
            <Flame size={17} />
          </button>
          <button
            type="button"
            onClick={() => setShowFreeze(true)}
            className={`${focus ? "h-11" : "h-11"} grid place-items-center rounded-full border border-sky-200 bg-[#eefbff] text-sky-900`}
            aria-label="先冻结"
          >
            <Snowflake size={17} />
          </button>
        </div>
      </motion.article>
    </div>
  );
}

function SparkLayer({ seed, active }: { seed: number; active: boolean }) {
  if (!active) {
    return null;
  }

  return (
    <div key={seed} className="pointer-events-none absolute inset-x-8 top-8 z-10 h-20">
      {Array.from({ length: 7 }).map((_, index) => (
        <span
          key={`${seed}-${index}`}
          className="spark absolute size-1.5 rounded-full bg-gold"
          style={{
            left: `${18 + index * 10}%`,
            top: `${26 + (index % 3) * 12}px`,
            "--spark-x": `${index % 2 === 0 ? "-" : ""}${18 + index * 3}px`
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
