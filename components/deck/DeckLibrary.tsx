"use client";

import { BookOpen, Flame, Layers3 } from "lucide-react";
import { useNextCardStore } from "@/store/useNextCardStore";
import { CardTimeUI } from "@/components/deck/CardTimeUI";

export function DeckLibrary() {
  const { deck, openDeck } = useNextCardStore();
  const activeDeck = deck.decks.find((item) => item.id === deck.activeDeckId);
  const activeCard = activeDeck?.cards.find((card) => card.id === deck.currentCardId) ?? activeDeck?.cards[0];

  if (deck.decks.length === 0) {
    return (
      <section className="rounded-[2rem] border border-dashed border-ink/18 bg-white/50 p-8 text-center shadow-soft">
        <Layers3 className="mx-auto text-ink/42" size={34} />
        <h2 className="mt-4 font-editorial text-[2rem] text-ink">还没有 deck</h2>
        <p className="mx-auto mt-2 max-w-[28rem] text-sm leading-6 text-ink/60">
          先到 input 生成三套方案并选择其中一个，这里会出现卡组封面。
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[2rem] border border-ink/10 bg-white/48 p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-editorial text-[2rem] text-ink">Deck library</h2>
          <span className="rounded-full bg-ink/8 px-3 py-1 text-xs font-semibold text-ink/62">{deck.decks.length} decks</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {deck.decks.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openDeck(item.id)}
              className="stacked-cover min-h-48 overflow-hidden rounded-[1.65rem] border border-ink/10 bg-[#fff8f1] p-5 text-left shadow-card transition hover:-translate-y-1"
            >
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="grid size-11 place-items-center rounded-full bg-ink text-white">
                    {item.coverIcon === "course" ? <BookOpen size={20} /> : <Flame size={20} />}
                  </div>
                  <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-ink/58">{item.deckStatus}</div>
                </div>
                <div>
                  <h3 className="font-editorial text-[1.9rem] leading-tight text-ink">{item.coverTitle}</h3>
                  <p className="mt-2 text-sm text-ink/58">
                    {item.completedCards} / {item.totalCards} cards
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-ink/10 bg-white/48 p-5 shadow-soft">
        {activeDeck && activeCard ? (
          <div className="mx-auto max-w-[28rem]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fern">{activeDeck.coverTitle}</div>
                <h2 className="font-editorial text-[2rem] text-ink">Active card</h2>
              </div>
              <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white">1 / {activeDeck.totalCards}</span>
            </div>
            <article className="relative overflow-hidden rounded-[1.8rem] border border-ink/10 bg-[#fff8f1] p-5 shadow-card">
              {activeCard.damageEffect === "burn" && (
                <div className="pointer-events-none absolute inset-x-0 top-0 h-2 burn-rail" />
              )}
              <CardTimeUI card={activeCard} />
              <h3 className="mt-5 font-editorial text-[2rem] leading-tight text-ink">{activeCard.title}</h3>
              <p className="mt-3 text-sm leading-6 text-ink/70">{activeCard.action}</p>
              <p className="mt-5 rounded-[1.05rem] bg-ink/[0.055] px-4 py-3 text-sm leading-6 text-ink/64">
                {activeCard.cardBackNote}
              </p>
            </article>
          </div>
        ) : (
          <div className="grid min-h-96 place-items-center text-center text-ink/58">选择一个 deck 查看单卡执行面。</div>
        )}
      </section>
    </div>
  );
}
