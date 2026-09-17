"use client";

import dynamic from "next/dynamic";

const LeafletMap = dynamic(
  () => import("./leaflet-map").then((mod) => mod.LeafletMap),
  { ssr: false }
);

export function MapView() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <p className="text-sm text-muted-foreground">
        이미 개설된 채팅방을 클릭하여 입장하거나, 새로운 곳을 클릭하여 채팅방을
        개설 할 수 있습니다.
      </p>
      <LeafletMap />
    </div>
  );
}
