"use client";

import dynamic from "next/dynamic";

const BattleOfTanks = dynamic(
  () => import("@/components/tanks").then((mod) => mod.App),
  { ssr: false }
);

export default function BattleOfTanksPage() {
  return (
    <div 
      className="w-screen h-screen overflow-hidden bg-[#111] font-mono [&_canvas]:block"
      style={{ cursor: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cpolygon points='16,5 25.5,10.5 25.5,21.5 16,27 6.5,21.5 6.5,10.5' fill='none' stroke='black' stroke-width='3' opacity='0.3'/%3E%3Cpolygon points='16,5 25.5,10.5 25.5,21.5 16,27 6.5,21.5 6.5,10.5' fill='none' stroke='white' stroke-width='1.5' opacity='0.8'/%3E%3Ccircle cx='16' cy='16' r='2' fill='white' opacity='0.9'/%3E%3C/svg%3E\") 16 16, crosshair" }}
    >
      <BattleOfTanks />
    </div>
  );
}
