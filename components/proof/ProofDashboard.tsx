"use client";

import { Archive, Flame, Gift, Snowflake, Table2, type LucideIcon } from "lucide-react";
import type { ProofRecord } from "@/lib/types";
import { useNextCardStore } from "@/store/useNextCardStore";

const statusTone = {
  completed: "bg-emerald-700 text-white",
  "in-progress": "bg-cyan-700 text-white",
  frozen: "bg-sky-100 text-sky-900",
  rewarded: "bg-[#e8b84d] text-ink",
  "needs-review": "bg-orange-100 text-orange-900"
} as const;

export function ProofDashboard() {
  const { proofs, deck, openOverlay } = useNextCardStore();
  const records = proofs.records;
  const continuing = records.filter((record) => record.status === "in-progress").length;
  const frozen = records.filter((record) => record.status === "frozen").length;
  const rewarded = records.filter((record) => record.status === "rewarded").length + deck.rewardCards.length;
  const actualMinutes = records.reduce((sum, record) => sum + record.actualMinutes, 0);
  const burning = records.filter((record) => record.timeStatus === "burning-completed" || record.lastDamageEffect === "burn").length;
  const rescheduled = records.filter((record) => record.timeStatus === "frozen-rescheduled" || record.status === "frozen").length;
  const latestRows = records.slice(0, 4);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="grid grid-cols-4 gap-2">
        <StatCard icon={Archive} label="今日证据" value={records.length.toString()} onClick={() => openOverlay("evidence-review")} />
        <StatCard icon={Gift} label="奖励卡" value={rewarded.toString()} onClick={() => openOverlay("reward-review")} />
        <StatCard icon={Snowflake} label="冻结重排" value={rescheduled.toString()} onClick={() => openOverlay("frozen-todo-review")} />
        <StatCard icon={Flame} label="燃烧完成" value={burning.toString()} onClick={() => openOverlay("burn-failed-review")} />
      </div>

      <div className="mt-3 rounded-[1.55rem] border border-ink/10 bg-white/62 p-4 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => openOverlay("summary-review")}
            className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-fern"
          >
            summary
          </button>
          <button
            type="button"
            onClick={() => openOverlay("proof-excel-review")}
            className="flex h-8 items-center gap-1.5 rounded-full bg-ink px-2.5 text-[0.68rem] font-semibold text-white"
          >
            <Table2 size={13} />
            完成表
          </button>
        </div>
        <button
          type="button"
          onClick={() => openOverlay("summary-review")}
          className="mt-3 block w-full text-left"
        >
          <p className="max-h-[7.6rem] overflow-hidden text-[0.95rem] leading-7 text-ink/82">{proofs.summaryDocument}</p>
        </button>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <SummaryChip label="continuing" value={continuing.toString()} />
          <SummaryChip label="frozen" value={frozen.toString()} />
          <SummaryChip label="actual" value={`${actualMinutes}m`} />
          <button
            type="button"
            onClick={() => openOverlay("proof-excel-review")}
            className="min-w-0 rounded-[0.9rem] bg-[#edf5ef] px-2 py-2 text-left"
          >
            <div className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-ink/36">table</div>
            <div className="mt-1 truncate text-sm font-semibold text-ink">查看</div>
          </button>
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[1.55rem] border border-ink/10 bg-white/62 p-4 shadow-soft">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-fern">proof</div>
            <h2 className="mt-1 font-editorial text-[1.55rem] text-ink">最新行动证据</h2>
          </div>
          <span className="rounded-full bg-ink/8 px-3 py-1 text-xs font-semibold text-ink/62">{records.length} total</span>
        </div>

        <div className="grid gap-2 overflow-hidden">
          {latestRows.map((record) => (
            <ProofRow key={record.id} record={record} onOpen={() => openOverlay("proof-record-review", record.id)} />
          ))}
          {latestRows.length === 0 && (
            <div className="rounded-[1rem] bg-white/54 px-3 py-8 text-center text-sm text-ink/52">
              还没有记录。选择执行方案后会自动写入第一条 proof。
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-[7.55rem] min-w-0 content-between rounded-[1rem] border border-ink/10 bg-white/64 p-2.5 text-left shadow-sm transition hover:bg-white/78"
    >
      <Icon size={16} className="text-ink/58" />
      <div>
        <div className="font-editorial text-[1.55rem] leading-none text-ink">{value}</div>
        <div className="mt-1 truncate text-[0.62rem] font-semibold uppercase tracking-[0.06em] text-ink/44">{label}</div>
      </div>
    </button>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[0.9rem] bg-ink/[0.045] px-3 py-2">
      <div className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-ink/36">{label}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}

function ProofRow({ record, onOpen }: { record: ProofRecord; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="rounded-[1.1rem] border border-ink/8 bg-white/70 p-3 text-left text-sm text-ink/70 transition hover:bg-white/82"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold leading-5 text-ink">{record.goalTitle}</h3>
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink/38">{record.source}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[record.status]}`}>
          {record.status}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <ProofMetric label="完成度" value={`${record.progress}%`} />
        <ProofMetric label="done" value={record.completedCards.toString()} />
        <ProofMetric label="frozen" value={record.frozenCards.toString()} />
        <ProofMetric label="actual" value={`${record.actualMinutes}m`} />
      </div>
      <div className="mt-3 rounded-[0.95rem] bg-ink/[0.045] px-3 py-2">
        <div className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-ink/38">{record.timeStatus}</div>
        <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5">{record.lastAction}</p>
      </div>
    </button>
  );
}

function ProofMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[0.75rem] bg-ink/[0.045] px-2 py-1.5">
      <div className="truncate text-[0.58rem] font-semibold uppercase tracking-[0.06em] text-ink/36">{label}</div>
      <div className="mt-0.5 truncate text-xs font-semibold leading-4 text-ink/72">{value}</div>
    </div>
  );
}
