"use client";

import { CheckCircle2, Flame, Snowflake, Table2, type LucideIcon } from "lucide-react";
import type { ProofRecord, TaskDeck } from "@/lib/types";
import { useNextCardStore } from "@/store/useNextCardStore";

type ProjectStatus = "completed" | "active" | "frozen" | "failed" | "queued";

type ProofProjectRecord = {
  id: string;
  deckId?: string;
  title: string;
  status: ProjectStatus;
  proofCount: number;
  updatedAt: string;
  summary: string;
  progress: number;
  completedCards: number;
  totalCards: number;
  canResume: boolean;
};

const statusTone: Record<ProjectStatus, { label: string; chip: string }> = {
  completed: {
    label: "完成",
    chip: "bg-moss/10 text-moss ring-moss/15"
  },
  active: {
    label: "进行中",
    chip: "bg-ink/[0.06] text-ink ring-ink/10"
  },
  frozen: {
    label: "冰冻任务",
    chip: "bg-sky-50 text-sky-900 ring-sky-200/70"
  },
  failed: {
    label: "燃烧",
    chip: "bg-[#fff1e8] text-ember ring-ember/18"
  },
  queued: {
    label: "待开始",
    chip: "bg-ink/[0.045] text-ink/56 ring-ink/8"
  }
};

export function ProofDashboard() {
  const { proofs, deck, openOverlay, resumeFrozenDeck } = useNextCardStore();
  const projects = buildProofProjects(deck.decks, proofs.records);
  const latestProject = projects.find((project) => project.proofCount > 0) ?? projects[0];
  const frozenProject = projects.find((project) => project.status === "frozen" && project.deckId);
  const completed = projects.filter((project) => project.status === "completed").length;
  const frozen = projects.filter((project) => project.status === "frozen").length;
  const failed = projects.filter((project) => project.status === "failed").length;
  const todayProofCount = proofs.records.filter(isToday).length;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <article className="relative overflow-hidden rounded-[1.6rem] border border-ink/10 bg-[#fffaf4]/82 p-5 shadow-[0_18px_46px_rgba(31,41,35,0.08)] backdrop-blur">
        <div className="pointer-events-none absolute -right-6 top-0 size-32 rounded-full bg-moss/8 blur-2xl" aria-hidden />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div>
            <div className="text-[0.72rem] font-semibold tracking-[0.14em] text-fern">今日证据</div>
            <div className="mt-7 font-editorial text-[4.2rem] leading-none text-moss">{todayProofCount}</div>
          </div>
          <button
            type="button"
            onClick={() => openOverlay("proof-excel-review")}
            className="mt-16 flex h-10 shrink-0 items-center gap-2 rounded-full bg-moss px-4 text-sm font-semibold text-white shadow-[0_14px_26px_rgba(15,83,53,0.2)]"
          >
            <Table2 size={15} />
            完成表
          </button>
        </div>
        <p className="relative z-10 mt-5 text-sm leading-6 text-ink/62">
          {todayProofCount > 0 ? "最新任务记录已按项目收纳。" : "先完成一张卡，证据会自动出现。"}
        </p>
      </article>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatusTile icon={CheckCircle2} label="完成" value={completed} tone="done" />
        <StatusTile
          icon={Snowflake}
          label="冰冻任务"
          value={frozen}
          tone="frozen"
          onClick={frozenProject?.deckId ? () => resumeFrozenDeck(frozenProject.deckId as string) : undefined}
        />
        <StatusTile icon={Flame} label="燃烧" value={failed} tone="burn" />
      </div>

      <article className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[1.6rem] border border-ink/10 bg-[#fffaf4]/72 p-5 shadow-[0_18px_46px_rgba(31,41,35,0.07)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-editorial text-[1.8rem] leading-none text-ink">最近一条证据</h2>
          <span className="text-sm font-semibold text-ink/68">{latestProject?.proofCount ?? 0}</span>
        </div>

        <div className="mt-14">
          {latestProject ? (
            <RecentProof project={latestProject} onResume={latestProject.deckId ? () => resumeFrozenDeck(latestProject.deckId as string) : undefined} />
          ) : (
            <div className="grid min-h-[12rem] place-items-center text-center">
              <p className="text-sm font-semibold leading-6 text-ink/58">
                完成第一张卡后，这里会出现证据。
              </p>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  tone,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: "done" | "frozen" | "burn";
  onClick?: () => void;
}) {
  const classes = {
    done: "bg-moss text-white shadow-[0_14px_26px_rgba(15,83,53,0.2)]",
    frozen: "bg-[linear-gradient(135deg,#e9fbff,#c9eff8)] text-sky-950 shadow-[0_14px_28px_rgba(125,211,252,0.18)]",
    burn: "bg-[#e8754e] text-white shadow-[0_14px_26px_rgba(231,120,75,0.18)]"
  }[tone];
  const content = (
    <>
      <span className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon size={14} />
        <span className="truncate">{label}</span>
      </span>
      <span className="font-editorial text-[1.45rem] leading-none">{value}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex h-[4.85rem] min-w-0 items-center justify-between gap-2 rounded-[1rem] px-3 text-left transition active:scale-[0.98] ${classes}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`flex h-[4.85rem] min-w-0 items-center justify-between gap-2 rounded-[1rem] px-3 ${classes}`}>
      {content}
    </div>
  );
}

function RecentProof({
  project,
  onResume
}: {
  project: ProofProjectRecord;
  onResume?: () => void;
}) {
  const tone = statusTone[project.status];

  return (
    <div className="rounded-[1.2rem] border border-ink/8 bg-white/62 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[0.66rem] font-semibold ring-1 ${tone.chip}`}>
            {tone.label}
          </span>
          <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-ink">{project.title}</h3>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink/52">{project.summary}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-editorial text-[2rem] leading-none text-ink">{project.progress}%</div>
          <div className="mt-1 text-[0.64rem] font-semibold text-ink/34">{formatDate(project.updatedAt)}</div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-ink/[0.07] pt-3 text-[0.7rem] font-semibold text-ink/42">
        <span>{project.completedCards}/{project.totalCards} 完成 · {project.proofCount} proof</span>
        {project.canResume && onResume && (
          <button
            type="button"
            onClick={onResume}
            className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"
          >
            继续
          </button>
        )}
      </div>
    </div>
  );
}

function buildProofProjects(decks: TaskDeck[], records: ProofRecord[]): ProofProjectRecord[] {
  const deckIds = new Set(decks.map((item) => item.id));
  const deckProjects = decks.map((item) => makeDeckProject(item, records.filter((record) => record.deckId === item.id)));
  const orphanGroups = groupByTitle(records.filter((record) => !record.deckId || !deckIds.has(record.deckId)));
  const orphanProjects = Array.from(orphanGroups.entries()).map(([title, group], index) => makeOrphanProject(title, group, index));

  return [...deckProjects, ...orphanProjects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function makeDeckProject(deck: TaskDeck, records: ProofRecord[]): ProofProjectRecord {
  const sorted = sortRecords(records);
  const completedCards = deck.cards.filter((card) => card.status === "completed" || card.status === "rewarded").length;
  const progress = deck.totalCards === 0 ? 0 : Math.round((completedCards / deck.totalCards) * 100);

  return {
    id: deck.id,
    deckId: deck.id,
    title: deck.coverTitle,
    status: getProjectStatus(deck, records),
    proofCount: records.length,
    updatedAt: sorted[0]?.createdAt ?? new Date(0).toISOString(),
    summary: makeProjectSummary(deck, sorted[0], records.length),
    progress,
    completedCards,
    totalCards: deck.totalCards,
    canResume: deck.deckStatus === "frozen"
  };
}

function makeOrphanProject(title: string, records: ProofRecord[], index: number): ProofProjectRecord {
  const sorted = sortRecords(records);
  const latest = sorted[0];
  const completedCards = Math.max(...records.map((record) => record.completedCards), 0);
  const progress = Math.max(...records.map((record) => record.progress), 0);

  return {
    id: `orphan-${index}-${title}`,
    title,
    status: latest?.status === "failed" ? "failed" : latest?.status === "frozen" ? "frozen" : progress >= 100 ? "completed" : "active",
    proofCount: records.length,
    updatedAt: latest?.createdAt ?? new Date(0).toISOString(),
    summary: makeProjectSummary(undefined, latest, records.length),
    progress,
    completedCards,
    totalCards: Math.max(completedCards, 1),
    canResume: false
  };
}

function getProjectStatus(deck: TaskDeck, records: ProofRecord[]): ProjectStatus {
  if (deck.deckStatus === "failed" || records.some((record) => record.status === "failed")) {
    return "failed";
  }

  if (deck.deckStatus === "frozen" || records.some((record) => record.status === "frozen")) {
    return "frozen";
  }

  if (deck.deckStatus === "completed") {
    return "completed";
  }

  return records.length > 0 ? "active" : "queued";
}

function makeProjectSummary(deck: TaskDeck | undefined, latest: ProofRecord | undefined, proofCount: number) {
  if (deck?.deckStatus === "failed") {
    return `燃烧锁定 · 包含 ${deck.totalCards} 张卡`;
  }

  if (deck?.deckStatus === "frozen") {
    return `冰冻任务 · 缓存 ${Math.max(deck.totalCards - deck.completedCards, 0)} 张待定卡`;
  }

  if (!latest) {
    return "还没有 proof，进入 deck 后开始记录。";
  }

  const action = latest.lastAction
    .replace(/^完成：/, "")
    .replace(/^冻结任务：/, "")
    .replace(/^冰冻任务：/, "")
    .replace(/^恢复冰冻任务：/, "")
    .replace(/^任务失败：/, "")
    .replace(/^奖励卡生成：/, "");
  return `${action} · ${proofCount} 条 proof`;
}

function groupByTitle(records: ProofRecord[]) {
  return records.reduce((map, record) => {
    const group = map.get(record.goalTitle) ?? [];
    group.push(record);
    map.set(record.goalTitle, group);
    return map;
  }, new Map<string, ProofRecord[]>());
}

function sortRecords(records: ProofRecord[]) {
  return [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function isToday(record: ProofRecord) {
  const date = new Date(record.createdAt);
  const now = new Date();

  return date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime()) || date.getTime() === 0) {
    return "未更新";
  }

  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  });
}
