import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AnnualProjection } from "../../types";

interface Props {
  projections: AnnualProjection[];
  displayMode: "nominal" | "real";
  inflationRate: number;
}

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function deflate(val: number, yearIndex: number, inflationRate: number, mode: "nominal" | "real") {
  if (mode === "nominal") return val;
  return val / Math.pow(1 + inflationRate, yearIndex);
}

export default function CashFlowTable({ projections, displayMode, inflationRate }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(year: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  if (projections.length === 0) {
    return <div className="text-center py-12 text-slate-400 text-sm">Run a simulation to see cash flow data.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
          <tr>
            <th className="text-left px-3 py-2 font-medium text-slate-600 w-8"></th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">Year</th>
            <th className="text-left px-3 py-2 font-medium text-slate-600">Ages</th>
            <th className="text-right px-3 py-2 font-medium text-slate-600">Income</th>
            <th className="text-right px-3 py-2 font-medium text-slate-600">Fed. Tax</th>
            <th className="text-right px-3 py-2 font-medium text-slate-600">Expenses</th>
            <th className="text-right px-3 py-2 font-medium text-slate-600">Net Flow</th>
            <th className="text-right px-3 py-2 font-medium text-slate-600">Portfolio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {projections.map((p, yi) => {
            const d = (v: number) => deflate(v, yi, inflationRate, displayMode);
            const netFlow = d(p.earnedIncome) - d(p.federalTax) - d(p.totalExpenses) + d(p.contributions) - d(p.withdrawals);
            const isExpanded = expanded.has(p.year);
            const isAccumulating = p.withdrawals === 0 && p.earnedIncome > 0;

            return (
              <React.Fragment key={p.year}>
                <tr
                  className={`hover:bg-slate-50 cursor-pointer ${isAccumulating ? "" : "bg-orange-50/30"}`}
                  onClick={() => toggle(p.year)}
                >
                  <td className="px-3 py-2 text-slate-400">
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">{p.year}</td>
                  <td className="px-3 py-2 text-slate-500">{p.age_spouse1}/{p.age_spouse2}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-800">{fmt.format(d(p.earnedIncome))}</td>
                  <td className="px-3 py-2 text-right font-mono text-red-600">{fmt.format(d(p.federalTax))}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">{fmt.format(d(p.totalExpenses))}</td>
                  <td className={`px-3 py-2 text-right font-mono font-medium ${netFlow >= 0 ? "text-emerald-600" : "text-orange-600"}`}>
                    {netFlow >= 0 ? "+" : ""}{fmt.format(netFlow)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-800">{fmt.format(d(p.portfolioEndBalance))}</td>
                </tr>
                {isExpanded && (
                  <tr className="bg-slate-50/80">
                    <td />
                    <td colSpan={7} className="px-3 py-3">
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <div className="font-semibold text-slate-600 mb-1.5">Income Breakdown</div>
                          <div className="space-y-0.5 text-slate-500">
                            <div className="flex justify-between"><span>Earned income</span><span className="font-mono">{fmt.format(d(p.earnedIncome))}</span></div>
                            <div className="flex justify-between"><span>Investment income</span><span className="font-mono">{fmt.format(d(p.investmentIncome))}</span></div>
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-600 mb-1.5">Portfolio Activity</div>
                          <div className="space-y-0.5 text-slate-500">
                            <div className="flex justify-between"><span>Contributions</span><span className="font-mono text-emerald-600">+{fmt.format(d(p.contributions))}</span></div>
                            <div className="flex justify-between"><span>Withdrawals</span><span className="font-mono text-orange-600">{fmt.format(d(p.withdrawals))}</span></div>
                            <div className="flex justify-between"><span>Investment gains</span><span className="font-mono">{fmt.format(d(p.investmentGains))}</span></div>
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-600 mb-1.5">Tax</div>
                          <div className="space-y-0.5 text-slate-500">
                            <div className="flex justify-between"><span>Federal tax</span><span className="font-mono">{fmt.format(d(p.federalTax))}</span></div>
                            <div className="flex justify-between"><span>Effective rate</span><span className="font-mono">{(p.effectiveTaxRate * 100).toFixed(1)}%</span></div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
