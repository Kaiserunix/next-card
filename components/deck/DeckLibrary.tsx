"use client";

import { Layers3 } from "lucide-react";
import type { TaskCard, TaskDeck } from "@/lib/types";
import { RewardCard } from "@/components/deck/RewardCard";
import { SwipeTaskCard } from "@/components/deck/SwipeTaskCard";
import { useNextCardStore } from "@/store/useNextCardStore";

export function DeckLibrary() {
  const { deck } = useNextCardStore();
  const activeDeck = deck.decks.find((item) => item.id === deck.activeDeckId) ?? deck.decks[0];
  const activeCard = getActiveCard(activeDeck, deck.currentCardId);
  const latestReward = activeDeck
    ? deck.rewardCards.find((reward) => reward.deckId === activeDeck.id)
    : null;

  if (deck.decks.length === 0) {
    return (
      <section className="phone-shell grain flex h-full min-h-0 flex-col items-center justify-center overflow-hidden p-6 text-center shadow-soft">
        <Layers3 className="relative z-10 text-ink/42" size={34} />
        <h2 className="relative z-10 mt-4 font-editorial text-[1.85rem] text-ink">还没有 deck</h2>
        <p className="relative z-10 mx-auto mt-2 max-w-[18rem] text-sm leading-6 text-ink/60">
          先到 input 生成一张行动卡。
        </p>
      </section>
    );
  }

  return (
    <section className="phone-shell grain relative flex h-full min-h-0 w-full flex-col overflow-hidden p-3">
      <div className="relative z-10 h-full min-h-0">
        {activeDeck && activeCard ? (
          <SwipeTaskCard deck={activeDeck} card={activeCard} focus />
        ) : activeDeck?.deckStatus === "completed" && latestReward ? (
          <div className="flex h-full min-h-0 items-center">
            <RewardCard reward={latestReward} />
          </div>
        ) : (
          <div className="grid h-full min-h-0 place-items-center rounded-[1.5rem] border border-ink/10 bg-white/56 px-5 text-center text-sm leading-6 text-ink/58">
            这一组已经完成，证据已进入 proof。
          </div>
        )}
      </div>
    </section>
  );
}

function getActiveCard(deck: TaskDeck | undefined, currentCardId: string | null): TaskCard | undefined {
  if (!deck) {
    return undefined;
  }

  return (
    deck.cards.find((card) => card.id === currentCardId) ??
    deck.cards.find((card) => card.status === "active") ??
    deck.cards.find((card) => card.status === "queued")
  );
}
