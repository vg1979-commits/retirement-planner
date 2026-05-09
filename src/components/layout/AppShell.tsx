import React from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

interface Props {
  children: React.ReactNode;
}

export default function AppShell({ children }: Props) {
  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
