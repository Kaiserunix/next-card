"use client";

import { Clock3, Timer } from "lucide-react";
import type { TaskCard } from "@/lib/types";
import { mockGenerateTimePlanForCard } from "@/lib/mock-ai";

export function CardTimeUI({ card }: { card: TaskCard }) {
  const timePlan = mockGenerateTimePlanForCard(card);
  const progress = Math.min(100, Math.max(10, card.damageProgress || 24));

  return (
    <div className="rounded-[1.15rem] border border-ink/8 bg-white/68 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-ink/64">
        <span className="flex items-center gap-1.5">
          <Clock3 size={14} />
          {card.estimatedMinutes} min
        </span>
        <span className="flex items-center gap-1.5">
          <Timer size={14} />
          {timePlan.windowLabel}
        </span>
        <span className="rounded-full bg-ink/8 px-2.5 py-1">{card.urgencyStage}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/8">
        <div
          className={`h-full rounded-full ${card.damageEffect === "burn" ? "burn-rail" : "bg-moss"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
