"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { LocateFixedIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { createRoom, CreateRoomError, getRoomList } from "@/features/apiutil";
import type { Room } from "@/features/apiutil";

// components/ui/input.tsx의 class와 동일하게 맞춘다. 팝업 안 input은 순수
// DOM이라 Input 컴포넌트를 그대로 못 쓴다.
const INPUT_CLASS_NAME =
  "h-7 w-full min-w-0 rounded-md border border-input bg-input/20 px-2 py-0.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

const SEOUL: L.LatLngTuple = [37.5665, 126.978];
const DEFAULT_ZOOM = 13;
const LOCATE_ZOOM = 16;
const ROOM_LIST_LIMIT = 100;

function hasCoordinates(
  room: Room
): room is Room & { posX: number; posY: number } {
  return typeof room.posX === "number" && typeof room.posY === "number";
}

// Leaflet의 기본 마커 아이콘 경로는 번들러 환경에서 깨지므로 CDN 경로로 명시한다.
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const EMPTY_TITLE_MESSAGE = "방 제목이 없어서 방 생성을 할 수 없습니다.";

// 팝업 안 내용은 Leaflet이 관리하는 순수 DOM이라 React 컴포넌트를 그대로 넣을
// 수 없다. 대신 shadcn Button/Input과 같은 class를 붙여서 시각적으로만
// 동일하게 만든다.
function createRoomPopupContent(
  lat: number,
  lng: number,
  onCreateRoom: (title: string) => void
) {
  const container = document.createElement("div");
  container.className = "flex w-56 flex-col gap-2 py-1";

  const coords = document.createElement("p");
  coords.className = "text-xs text-muted-foreground";
  coords.textContent = `위치: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  container.appendChild(coords);

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "방 제목";
  titleInput.className = INPUT_CLASS_NAME;
  container.appendChild(titleInput);

  const errorMessage = document.createElement("p");
  errorMessage.className = "text-xs text-destructive hidden";
  errorMessage.textContent = EMPTY_TITLE_MESSAGE;
  container.appendChild(errorMessage);

  titleInput.addEventListener("input", () => {
    if (titleInput.value.trim()) {
      errorMessage.classList.add("hidden");
    }
  });

  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = buttonVariants({ size: "sm" });
  createButton.textContent = "방 생성";
  createButton.addEventListener("click", () => {
    const title = titleInput.value.trim();
    if (!title) {
      errorMessage.classList.remove("hidden");
      titleInput.focus();
      return;
    }
    onCreateRoom(title);
  });
  container.appendChild(createButton);

  return { container, createButton };
}

export function LeafletMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const roomMarkersLayerRef = useRef<L.LayerGroup | null>(null);
  const isFetchingRoomsRef = useRef(false);
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

    const roomMarkersLayer = L.layerGroup().addTo(map);
    roomMarkersLayerRef.current = roomMarkersLayer;

    async function refreshRoomMarkers() {
      // moveend/zoomend가 거의 동시에 겹쳐 들어와도 중복 조회는 한 번만
      // 진행한다.
      if (isFetchingRoomsRef.current) {
        return;
      }
      isFetchingRoomsRef.current = true;

      try {
        const rooms = await getRoomList({ limit: ROOM_LIST_LIMIT });
        roomMarkersLayer.clearLayers();

        for (const room of rooms.filter(hasCoordinates)) {
          const label = room.name ?? room.id;
          L.marker([room.posY, room.posX])
            .addTo(roomMarkersLayer)
            .bindPopup(`${label} (${room.userCount}명 접속 중)`);
        }
      } catch (error) {
        // 카메라를 움직일 때마다 자동으로 도는 백그라운드 조회라 토스트로
        // 매번 방해하지 않고 콘솔에만 남긴다.
        console.error("방 목록을 불러오지 못했습니다.", error);
      } finally {
        isFetchingRoomsRef.current = false;
      }
    }

    map.on("moveend", refreshRoomMarkers);
    map.on("zoomend", refreshRoomMarkers);
    refreshRoomMarkers();

    function handleMapClick(event: L.LeafletMouseEvent) {
      const { lat, lng } = event.latlng;

      const { container, createButton } = createRoomPopupContent(
        lat,
        lng,
        async (title) => {
          createButton.disabled = true;
          createButton.textContent = "생성 중...";
          try {
            // 문서에 X/Y 중 무엇이 경도·위도인지 명시돼 있지 않아, 화면
            // 좌표계 관례대로 X=경도(lng), Y=위도(lat)로 매핑한다.
            const room = await createRoom({
              type: "named",
              name: title,
              posX: lng,
              posY: lat,
            });
            toast.add({
              title: "방을 생성했습니다.",
              description: `roomId: ${room.roomId}`,
              type: "success",
            });
            map.closePopup();
            refreshRoomMarkers();
          } catch (error) {
            toast.add({
              title: "방 생성에 실패했습니다.",
              description:
                error instanceof CreateRoomError
                  ? error.message
                  : "잠시 후 다시 시도해주세요.",
              type: "error",
            });
            createButton.disabled = false;
            createButton.textContent = "방 생성";
          }
        }
      );

      // 마커 없이 팝업만 띄운다. Leaflet 팝업은 setLatLng으로 지정한 좌표에
      // 꼬리가 붙고, autoClose 기본값 덕분에 이전 팝업은 자동으로 닫힌다.
      L.popup().setLatLng([lat, lng]).setContent(container).openOn(map);
    }

    map.on("click", handleMapClick);

    return () => {
      map.off("click", handleMapClick);
      map.off("moveend", refreshRoomMarkers);
      map.off("zoomend", refreshRoomMarkers);
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      roomMarkersLayerRef.current = null;
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
