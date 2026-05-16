"use client";

import { motion } from "framer-motion";
import { TopModeTabs } from "@/components/TopModeTabs";
import { DeckLibrary } from "@/components/deck/DeckLibrary";
import { TaskFlowOverview } from "@/components/flow/TaskFlowOverview";
import { InputComposer } from "@/components/input/InputComposer";
import { PlanModePanel } from "@/components/input/PlanModePanel";
import { ProofDashboard } from "@/components/proof/ProofDashboard";
import { useNextCardStore } from "@/store/useNextCardStore";

export default function Home() {
  const { mode, setMode } = useNextCardStore();

  return (
    <main className="min-h-[100dvh] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[78rem] flex-col gap-5">
        <TopModeTabs activeMode={mode} onChange={setMode} />

        {mode === "input" && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-5 lg:grid-cols-[25rem_minmax(0,1fr)]"
          >
            <InputComposer />
            <div className="space-y-5">
              <PlanModePanel />
              <TaskFlowOverview />
            </div>
          </motion.div>
        )}

        {mode === "deck" && (
          <motion.div key="deck" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <DeckLibrary />
          </motion.div>
        )}

        {mode === "proof" && (
          <motion.div key="proof" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <ProofDashboard />
          </motion.div>
        )}
      </div>
    </main>
  );
}
