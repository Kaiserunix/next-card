"use client";

import { Archive, Feather, Layers3 } from "lucide-react";
import type { Mode } from "@/lib/types";

const tabs: { id: Mode; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: Mode }[] = [
  { id: "input", icon: Feather, label: "input" },
  { id: "deck", icon: Layers3, label: "deck" },
  { id: "proof", icon: Archive, label: "proof" }
];

type TopModeTabsProps = {
  activeMode: Mode;
  onChange: (mode: Mode) => void;
};

export function TopModeTabs({ activeMode, onChange }: TopModeTabsProps) {
  return (
    <nav className="mx-auto grid w-full max-w-[25rem] grid-cols-3 gap-2 rounded-full border border-ink/10 bg-white/54 p-1 shadow-sm backdrop-blur">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeMode === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex h-10 items-center justify-center gap-2 rounded-full text-sm font-medium transition ${
              active
                ? "bg-ink text-white shadow-[0_10px_24px_rgba(6,63,39,0.22)]"
                : "text-ink/62 hover:bg-white/70 hover:text-ink"
            }`}
            aria-pressed={active}
          >
            <Icon size={16} strokeWidth={1.8} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
