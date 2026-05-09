import { useAppStore } from "./store/useAppStore";
import AppShell from "./components/layout/AppShell";
import InputsView from "./views/InputsView";
import ProjectionsView from "./views/ProjectionsView";
import CashFlowView from "./views/CashFlowView";
import TaxView from "./views/TaxView";
import ScenariosView from "./views/ScenariosView";

export default function App() {
  const activeView = useAppStore((s) => s.ui.activeView);

  const view = {
    inputs: <InputsView />,
    projections: <ProjectionsView />,
    cashflow: <CashFlowView />,
    taxes: <TaxView />,
    scenarios: <ScenariosView />,
  }[activeView];

  return <AppShell>{view}</AppShell>;
}
