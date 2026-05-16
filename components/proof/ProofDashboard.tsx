"use client";

import { Archive, Flame, Snowflake, type LucideIcon } from "lucide-react";
import { useNextCardStore } from "@/store/useNextCardStore";

export function ProofDashboard() {
  const { proofs } = useNextCardStore();
  const completed = proofs.records.filter((record) => record.status === "completed" || record.status === "rewarded").length;
  const frozen = proofs.records.filter((record) => record.status === "frozen").length;
  const burning = proofs.records.filter((record) => record.timeStatus === "burning-completed").length;

  return (
    <section className="webview-stack">
      <div className="grid gap-3">
        <StatCard icon={Archive} label="今日证据" value={proofs.records.length.toString()} />
        <StatCard icon={Flame} label="燃烧记录" value={burning.toString()} />
        <StatCard icon={Snowflake} label="冻结卡片" value={frozen.toString()} />
      </div>

      <div className="rounded-[2rem] border border-ink/10 bg-white/56 p-4 shadow-soft">
        <div className="flex flex-col gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fern">proof table</div>
            <h2 className="mt-1 font-editorial text-[1.85rem] text-ink">行动证据</h2>
          </div>
          <span className="w-fit rounded-full bg-ink/8 px-3 py-1 text-xs font-semibold text-ink/62">
            completed {completed}
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {proofs.records.map((record) => (
            <article key={record.id} className="rounded-[1.25rem] border border-ink/8 bg-white/64 p-4 text-sm text-ink/70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold leading-5 text-ink">{record.goalTitle}</h3>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink/38">{record.source}</div>
                </div>
                <span className="shrink-0 rounded-full bg-ink/8 px-2.5 py-1 text-xs font-semibold">{record.status}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <ProofMetric label="完成度" value={`${record.progress}%`} />
                <ProofMetric label="完成卡片" value={record.completedCards.toString()} />
                <ProofMetric label="冻结卡片" value={record.frozenCards.toString()} />
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
          ))}
          {proofs.records.length === 0 && (
            <div className="rounded-[1rem] bg-white/54 px-3 py-8 text-center text-sm text-ink/52">
              还没有记录。选择执行方案后会自动写入第一条 proof。
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[2rem] border border-ink/10 bg-[#fff8f1]/70 p-4 shadow-soft">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fern">summary document</div>
        <p className="mt-3 max-w-[48rem] text-sm leading-7 text-ink/70">{proofs.summaryDocument}</p>
      </div>
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
    <article className="rounded-[1.5rem] border border-ink/10 bg-white/56 p-5 shadow-sm">
      <Icon size={22} className="text-ink/58" />
      <div className="mt-5 font-editorial text-[2.2rem] leading-none text-ink">{value}</div>
      <div className="mt-2 text-sm font-medium text-ink/56">{label}</div>
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
