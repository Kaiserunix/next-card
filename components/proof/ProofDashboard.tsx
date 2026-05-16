"use client";

import { Archive, Flame, Gift, Snowflake, type LucideIcon } from "lucide-react";
import type { ProofRecord } from "@/lib/types";
import { useNextCardStore } from "@/store/useNextCardStore";

const statusTone = {
  completed: "bg-emerald-700 text-white",
  "in-progress": "bg-cyan-700 text-white",
  frozen: "bg-sky-100 text-sky-900",
  rewarded: "bg-[#e8b84d] text-ink",
  "needs-review": "bg-orange-100 text-orange-900"
} as const;

const dotTone = {
  completed: "bg-emerald-700",
  "in-progress": "bg-cyan-700",
  frozen: "bg-sky-400",
  rewarded: "bg-[#e8b84d]",
  "needs-review": "bg-orange-500"
} as const;

export function ProofDashboard() {
  const { proofs, deck } = useNextCardStore();
  const records = proofs.records;
  const completed = records.filter((record) => record.status === "completed" || record.status === "rewarded").length;
  const continuing = records.filter((record) => record.status === "in-progress").length;
  const frozen = records.filter((record) => record.status === "frozen").length;
  const rewarded = records.filter((record) => record.status === "rewarded").length + deck.rewardCards.length;
  const actualMinutes = records.reduce((sum, record) => sum + record.actualMinutes, 0);
  const burning = records.filter((record) => record.timeStatus === "burning-completed").length;
  const rescheduled = records.filter((record) => record.timeStatus === "frozen-rescheduled").length;
  const latestRows = records.slice(0, 8);
  const chartRows = records.filter((record) => record.progress > 0).slice(0, 4);

  return (
    <section className="webview-stack">
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Archive} label="今日证据" value={records.length.toString()} />
        <StatCard icon={Gift} label="奖励卡" value={rewarded.toString()} />
        <StatCard icon={Snowflake} label="冻结重排" value={rescheduled.toString()} />
        <StatCard icon={Flame} label="燃烧完成" value={burning.toString()} />
      </div>

      <div className="rounded-[2rem] border border-ink/10 bg-white/62 p-4 shadow-soft">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-fern">summary</div>
        <p className="mt-4 text-[1.02rem] leading-8 text-ink/82">{proofs.summaryDocument}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <SummaryChip label="continuing" value={continuing.toString()} />
          <SummaryChip label="frozen" value={frozen.toString()} />
          <SummaryChip label="actual" value={`${actualMinutes}m`} />
        </div>
      </div>

      <div className="rounded-[2rem] border border-ink/10 bg-white/62 p-4 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-fern">charts</div>
            <h2 className="mt-1 font-editorial text-[1.8rem] text-ink">动态进度</h2>
          </div>
          <ProgressRing progress={records.length === 0 ? 0 : Math.round((completed / records.length) * 100)} />
        </div>
        <div className="grid gap-3">
          {(chartRows.length > 0 ? chartRows : records.slice(0, 1)).map((record) => (
            <div key={record.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm text-ink/56">
                <span className="truncate">{record.goalTitle}</span>
                <span>{record.progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink/8">
                <div className="h-full rounded-full bg-moss" style={{ width: `${record.progress}%` }} />
              </div>
            </div>
          ))}
          {records.length === 0 && <div className="rounded-[1rem] bg-ink/[0.045] px-3 py-5 text-center text-sm text-ink/50">完成或冻结卡片后，这里会出现进度条。</div>}
        </div>
      </div>

      <div className="rounded-[2rem] border border-ink/10 bg-white/62 p-4 shadow-soft">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-fern">proof table</div>
            <h2 className="mt-1 font-editorial text-[1.8rem] text-ink">行动证据</h2>
          </div>
          <span className="rounded-full bg-ink/8 px-3 py-1 text-xs font-semibold text-ink/62">{latestRows.length} rows</span>
        </div>

        <div className="grid gap-3">
          {latestRows.map((record) => (
            <ProofRow key={record.id} record={record} />
          ))}
          {latestRows.length === 0 && (
            <div className="rounded-[1rem] bg-white/54 px-3 py-8 text-center text-sm text-ink/52">
              还没有记录。选择执行方案后会自动写入第一条 proof。
            </div>
          )}
        </div>
      </div>

      <FlowJournal records={records} />
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[1.4rem] border border-ink/10 bg-white/64 p-4 shadow-sm">
      <Icon size={20} className="text-ink/58" />
      <div className="mt-4 font-editorial text-[2rem] leading-none text-ink">{value}</div>
      <div className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink/44">{label}</div>
    </article>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] bg-ink/[0.045] px-3 py-2">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/36">{label}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function ProgressRing({ progress }: { progress: number }) {
  return (
    <div
      className="grid size-16 shrink-0 place-items-center rounded-full text-xs font-semibold text-ink"
      style={{
        background: `conic-gradient(#5f7b61 ${progress * 3.6}deg, rgba(17,19,15,0.08) 0deg)`
      }}
    >
      <div className="grid size-12 place-items-center rounded-full bg-white">{progress}%</div>
    </div>
  );
}

function ProofRow({ record }: { record: ProofRecord }) {
  return (
    <article className="rounded-[1.25rem] border border-ink/8 bg-white/70 p-4 text-sm text-ink/70">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold leading-5 text-ink">{record.goalTitle}</h3>
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink/38">{record.source}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[record.status]}`}>
          {record.status}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <ProofMetric label="完成度" value={`${record.progress}%`} />
        <ProofMetric label="卡片" value={`${record.completedCards} done / ${record.frozenCards} frozen`} />
        <ProofMetric label="实际用时" value={`${record.actualMinutes}m`} />
        <ProofMetric label="时间状态" value={record.timeStatus} />
      </div>
      <div className="mt-4 rounded-[1rem] bg-ink/[0.045] px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/38">最近行动</div>
        <p className="mt-1 leading-5">{record.lastAction}</p>
      </div>
      <div className="mt-2 rounded-[1rem] bg-[#fff8f1] px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/38">下一步建议</div>
        <p className="mt-1 leading-5">{record.nextSuggestion}</p>
      </div>
    </article>
  );
}

function ProofMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.95rem] bg-ink/[0.045] px-3 py-2">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink/36">{label}</div>
      <div className="mt-1 break-words text-xs font-semibold leading-4 text-ink/72">{value}</div>
    </div>
  );
}

function FlowJournal({ records }: { records: ProofRecord[] }) {
  const entries = records.slice().reverse();

  return (
    <section className="rounded-[2rem] border border-ink/10 bg-white p-4 shadow-soft">
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-end gap-3 border-b border-ink/10 pb-4">
        <div className="font-editorial text-[4.2rem] leading-[0.78] text-ink">03</div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-fern">flow journal</div>
          <h2 className="mt-2 font-editorial text-[1.65rem] leading-tight text-ink">
            行为变成
            <br />
            可读证据
          </h2>
        </div>
      </div>

      <div className="journal-window mt-3">
        <div className="journal-scroll" aria-label="Proof flow journal, scrollable">
          <div className="journal-track">
            {entries.map((record) => (
              <JournalEntry key={record.id} record={record} />
            ))}
            {entries.length === 0 && (
              <div className="rounded-[1rem] bg-ink/[0.045] px-3 py-8 text-center text-sm text-ink/52">
                完成、燃烧、冻结和奖励事件会在这里形成时间线。
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function JournalEntry({ record }: { record: ProofRecord }) {
  const title = getJournalTitle(record);
  const tags = [
    record.status,
    record.timeStatus,
    record.actualMinutes > 0 ? `actual ${record.actualMinutes}m` : null,
    record.lastDamageEffect ?? null
  ].filter(Boolean);

  return (
    <article className="journal-entry">
      <time>{formatTime(record.createdAt)}</time>
      <div className="journal-line">
        <span className={dotTone[record.status]} />
      </div>
      <div className="journal-card">
        <h3>{title}</h3>
        <p>
          {record.lastAction}。{record.timeDamageEvents.join("，")}。下一步建议：{record.nextSuggestion}
        </p>
        <div className="journal-tags">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function getJournalTitle(record: ProofRecord) {
  if (record.status === "rewarded") {
    return `奖励卡生成：${record.goalTitle}`;
  }

  if (record.status === "frozen") {
    return `“${record.goalTitle}”选择先冻结。`;
  }

  if (record.timeStatus === "burning-completed") {
    return "快速燃烧模式完成一张最低可行动作卡。";
  }

  if (record.status === "completed") {
    return `完成“${record.goalTitle}”的一张行动卡。`;
  }

  return `记录“${record.goalTitle}”的推进状态。`;
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(iso));
}
