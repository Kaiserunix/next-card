import type { TaskCard, TaskDeck } from "@/lib/types";

const protectedStatuses = new Set<TaskCard["status"]>(["completed", "frozen", "rewarded", "needs-review"]);

export function refreshCardTimeState(card: TaskCard, now: Date): TaskCard {
  if (protectedStatuses.has(card.status) || !card.deadlineAt) {
    return card;
  }

  const remainingSeconds = Math.floor((new Date(card.deadlineAt).getTime() - now.getTime()) / 1000);

  if (remainingSeconds <= 0) {
    return {
      ...card,
      urgencyStage: "expired",
      damageEffect: "crack",
      burnLevel: 0,
      remainingSeconds: 0,
      damageProgress: 100
    };
  }

  if (remainingSeconds <= 180) {
    return {
      ...card,
      urgencyStage: "burning",
      damageEffect: "burn",
      burnLevel: 3,
      remainingSeconds,
      damageProgress: 86
    };
  }

  if (remainingSeconds <= 1200) {
    return {
      ...card,
      urgencyStage: "hot",
      damageEffect: "burn",
      burnLevel: 2,
      remainingSeconds,
      damageProgress: 52
    };
  }

  return {
    ...card,
    urgencyStage: "calm",
    damageEffect: "none",
    burnLevel: 0,
    remainingSeconds,
    damageProgress: 0
  };
}

export function refreshDeckTimeState(deck: TaskDeck, now: Date): TaskDeck {
  return {
    ...deck,
    cards: deck.cards.map((card) => refreshCardTimeState(card, now))
  };
}
