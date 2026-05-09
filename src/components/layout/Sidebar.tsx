import {
  SlidersHorizontal,
  TrendingUp,
  DollarSign,
  Receipt,
  GitBranch,
  type LucideIcon,
} from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import type { UIState } from "../../types";

const NAV_ITEMS: { view: UIState["activeView"]; label: string; Icon: LucideIcon }[] = [
  { view: "inputs",      label: "Inputs",      Icon: SlidersHorizontal },
  { view: "projections", label: "Projections", Icon: TrendingUp },
  { view: "cashflow",    label: "Cash Flow",   Icon: DollarSign },
  { view: "taxes",       label: "Taxes",       Icon: Receipt },
  { view: "scenarios",   label: "Scenarios",   Icon: GitBranch },
];

export default function Sidebar() {
  const { ui, setActiveView } = useAppStore();

  return (
    <nav className="w-48 bg-slate-800 border-r border-slate-700 flex flex-col py-4 flex-shrink-0">
      {NAV_ITEMS.map(({ view, label, Icon }) => {
        const active = ui.activeView === view;
        return (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
              active
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
