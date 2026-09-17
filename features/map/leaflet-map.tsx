"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { LocateFixedIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

const SEOUL: L.LatLngTuple = [37.5665, 126.978];
const DEFAULT_ZOOM = 13;
const LOCATE_ZOOM = 16;

// Leaflet의 기본 마커 아이콘 경로는 번들러 환경에서 깨지므로 CDN 경로로 명시한다.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export function LeafletMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current).setView(SEOUL, DEFAULT_ZOOM);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    L.marker(SEOUL).addTo(map).bindPopup("서울");

    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
    };
  }, []);

  function handleLocate() {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (!("geolocation" in navigator)) {
      toast.add({
        title: "위치 정보를 사용할 수 없습니다.",
        description: "이 브라우저는 위치 정보 기능을 지원하지 않습니다.",
        type: "error",
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.flyTo([latitude, longitude], LOCATE_ZOOM);

        if (userMarkerRef.current) {
          userMarkerRef.current.setLatLng([latitude, longitude]);
        } else {
          userMarkerRef.current = L.marker([latitude, longitude]).addTo(map);
        }
        userMarkerRef.current.bindPopup("내 위치").openPopup();

        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        toast.add({
          title: "현재 위치를 가져오지 못했습니다.",
          description:
            error.code === error.PERMISSION_DENIED
              ? "브라우저 설정에서 위치 정보 접근을 허용해주세요."
              : "잠시 후 다시 시도해주세요.",
          type: "error",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="relative h-[70vh] w-full overflow-hidden rounded-md border border-border">
      <div ref={containerRef} className="h-full w-full" />
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute bottom-10 right-3 z-[1000] shadow-md"
        onClick={handleLocate}
        disabled={isLocating}
        aria-label="내 위치로 이동"
      >
        {isLocating ? <Spinner /> : <LocateFixedIcon />}
      </Button>
    </div>
  );
}
