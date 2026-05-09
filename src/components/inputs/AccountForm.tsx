import { useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import type { Account, AccountType } from "../../types";
import CurrencyInput from "../shared/CurrencyInput";

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  traditional_401k: "Traditional 401(k)",
  roth_401k: "Roth 401(k)",
  traditional_ira: "Traditional IRA",
  roth_ira: "Roth IRA",
  brokerage: "Taxable Brokerage",
  hsa: "HSA",
  cash: "Cash / HYSA",
  deferred_comp: "Deferred Compensation",
  pension: "Pension",
};

function newId() {
  return `acct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface Props {
  initial?: Account;
  onSave: () => void;
}

export default function AccountForm({ initial, onSave }: Props) {
  const upsertAccount = useAppStore((s) => s.upsertAccount);

  const [form, setForm] = useState<Account>(
    initial ?? {
      id: newId(),
      owner: "joint",
      type: "brokerage",
      label: "",
      currentBalance: 0,
      annualContribution: 0,
      employerMatch: undefined,
    }
  );

  function set<K extends keyof Account>(key: K, value: Account[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!form.label.trim()) return;
    upsertAccount(form);
    onSave();
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
        <input
          className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.label}
          onChange={(e) => set("label", e.target.value)}
          placeholder="e.g. Spouse 1 401(k)"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Owner</label>
          <select
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.owner}
            onChange={(e) => set("owner", e.target.value as Account["owner"])}
          >
            <option value="joint">Joint</option>
            <option value="spouse1">Spouse 1</option>
            <option value="spouse2">Spouse 2</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Account Type</label>
          <select
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.type}
            onChange={(e) => set("type", e.target.value as AccountType)}
          >
            {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => (
              <option key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      <CurrencyInput label="Current Balance" value={form.currentBalance} onChange={(v) => set("currentBalance", v)} />
      <CurrencyInput label="Annual Contribution" value={form.annualContribution} onChange={(v) => set("annualContribution", v)} />
      <CurrencyInput
        label="Employer Match (annual $, optional)"
        value={form.employerMatch ?? 0}
        onChange={(v) => set("employerMatch", v === 0 ? undefined : v)}
      />

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
        <input
          className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.vestingScheduleNote ?? ""}
          onChange={(e) => set("vestingScheduleNote", e.target.value || undefined)}
          placeholder="e.g. Backdoor Roth, vesting schedule..."
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!form.label.trim()}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-md transition-colors"
      >
        {initial ? "Save Changes" : "Add Account"}
      </button>
    </div>
  );
}
