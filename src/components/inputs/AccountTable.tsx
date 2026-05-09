import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import type { Account, AccountType } from "../../types";
import SlideOver from "../shared/SlideOver";
import AccountForm from "./AccountForm";

const TYPE_LABELS: Record<AccountType, string> = {
  traditional_401k: "Traditional 401(k)",
  roth_401k: "Roth 401(k)",
  traditional_ira: "Traditional IRA",
  roth_ira: "Roth IRA",
  brokerage: "Brokerage",
  hsa: "HSA",
  cash: "Cash",
  deferred_comp: "Deferred Comp",
  pension: "Pension",
};

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function AccountTable() {
  const { accounts, removeAccount } = useAppStore();
  const [slideOpen, setSlideOpen] = useState(false);
  const [editing, setEditing] = useState<Account | undefined>(undefined);

  function openNew() { setEditing(undefined); setSlideOpen(true); }
  function openEdit(a: Account) { setEditing(a); setSlideOpen(true); }

  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Accounts</h3>
        <button
          onClick={openNew}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          <Plus size={13} /> Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
          No accounts yet. Add your first account to get started.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Label</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Owner</th>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Type</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">Balance</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">Annual Contrib.</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">Match</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{a.label}</td>
                  <td className="px-3 py-2 text-slate-500 capitalize">{a.owner.replace("spouse", "Spouse ")}</td>
                  <td className="px-3 py-2 text-slate-500">{TYPE_LABELS[a.type]}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-800">{fmt.format(a.currentBalance)}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600">{fmt.format(a.annualContribution)}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">{a.employerMatch ? fmt.format(a.employerMatch) : "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => openEdit(a)} className="text-slate-400 hover:text-blue-600 transition-colors"><Pencil size={13} /></button>
                      <button onClick={() => removeAccount(a.id)} className="text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-slate-700">Total investable assets</td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">{fmt.format(totalBalance)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <SlideOver open={slideOpen} onClose={() => setSlideOpen(false)} title={editing ? "Edit Account" : "Add Account"}>
        <AccountForm initial={editing} onSave={() => setSlideOpen(false)} />
      </SlideOver>
    </div>
  );
}
