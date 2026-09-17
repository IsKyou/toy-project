"use client";

import dynamic from "next/dynamic";

const LeafletMap = dynamic(
  () => import("./leaflet-map").then((mod) => mod.LeafletMap),
  { ssr: false }
);

export function MapView() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        지도
      </h1>
      <LeafletMap />
    </div>
  );
}
