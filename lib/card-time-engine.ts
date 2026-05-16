import type { TaskCard, TaskDeck } from "@/lib/types";

const protectedStatuses = new Set<TaskCard["status"]>(["completed", "frozen", "rewarded", "needs-review"]);

export type CardTimeRefreshOptions = {
  preserveBurnFromUserAction?: boolean;
};

export function refreshCardTimeState(
  card: TaskCard,
  now: Date = new Date(),
  options: CardTimeRefreshOptions = {}
): TaskCard {
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
    if (options.preserveBurnFromUserAction && card.damageEffect === "burn") {
      return {
        ...card,
        urgencyStage: "hot",
        remainingSeconds
      };
    }

    return {
      ...card,
      urgencyStage: "hot",
      damageEffect: "burn",
      burnLevel: 2,
      remainingSeconds,
      damageProgress: 52
    };
  }

  if (options.preserveBurnFromUserAction && card.damageEffect === "burn") {
    return {
      ...card,
      urgencyStage: "calm",
      remainingSeconds
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

export function refreshDeckTimeState(
  deck: TaskDeck,
  now: Date = new Date(),
  options: CardTimeRefreshOptions = {}
): TaskDeck {
  return {
    ...deck,
    cards: deck.cards.map((card) => refreshCardTimeState(card, now, options))
  };
}
