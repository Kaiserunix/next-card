"use client";

import { Archive, Flame, Snowflake, type LucideIcon } from "lucide-react";
import { useNextCardStore } from "@/store/useNextCardStore";

export function ProofDashboard() {
  const { proofs } = useNextCardStore();
  const completed = proofs.records.filter((record) => record.status === "completed" || record.status === "rewarded").length;
  const frozen = proofs.records.filter((record) => record.status === "frozen").length;
  const burning = proofs.records.filter((record) => record.timeStatus === "burning-completed").length;

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Archive} label="今日证据" value={proofs.records.length.toString()} />
        <StatCard icon={Flame} label="燃烧记录" value={burning.toString()} />
        <StatCard icon={Snowflake} label="冻结卡片" value={frozen.toString()} />
      </div>

      <div className="rounded-[2rem] border border-ink/10 bg-white/50 p-5 shadow-soft">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-fern">proof table</div>
            <h2 className="mt-1 font-editorial text-[2rem] text-ink">行动证据</h2>
          </div>
          <span className="rounded-full bg-ink/8 px-3 py-1 text-xs font-semibold text-ink/62">
            completed {completed}
          </span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-ink/40">
              <tr>
                <th className="px-3 py-2">目标</th>
                <th className="px-3 py-2">来源</th>
                <th className="px-3 py-2">当前状态</th>
                <th className="px-3 py-2">完成度</th>
                <th className="px-3 py-2">时间状态</th>
                <th className="px-3 py-2">最近行动</th>
                <th className="px-3 py-2">下一步建议</th>
              </tr>
            </thead>
            <tbody>
              {proofs.records.map((record) => (
                <tr key={record.id} className="bg-white/62 text-ink/70">
                  <td className="rounded-l-[1rem] px-3 py-3 font-semibold text-ink">{record.goalTitle}</td>
                  <td className="px-3 py-3">{record.source}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-ink/8 px-2.5 py-1 text-xs font-semibold">{record.status}</span>
                  </td>
                  <td className="px-3 py-3">{record.progress}%</td>
                  <td className="px-3 py-3">{record.timeStatus}</td>
                  <td className="px-3 py-3">{record.lastAction}</td>
                  <td className="rounded-r-[1rem] px-3 py-3">{record.nextSuggestion}</td>
                </tr>
              ))}
              {proofs.records.length === 0 && (
                <tr>
                  <td colSpan={7} className="rounded-[1rem] bg-white/54 px-3 py-8 text-center text-ink/52">
                    还没有记录。选择执行方案后会自动写入第一条 proof。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-[2rem] border border-ink/10 bg-[#fff8f1]/70 p-5 shadow-soft">
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
    <article className="rounded-[1.5rem] border border-ink/10 bg-white/52 p-5 shadow-sm">
      <Icon size={22} className="text-ink/58" />
      <div className="mt-5 font-editorial text-[2.2rem] leading-none text-ink">{value}</div>
      <div className="mt-2 text-sm font-medium text-ink/56">{label}</div>
    </article>
  );
}
