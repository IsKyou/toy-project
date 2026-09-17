"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Room } from "@/features/apiutil";
import { getRoomList } from "@/features/apiutil";

// 가이드 시나리오 B: 이름이 있는(named) 방만 목록으로 노출한다. private 방은
// 64자리 hex id에 이름도 없어 "찾아 들어가라"고 만든 게 아니다.
export function RoomLobbyView() {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getRoomList({ type: "named", limit: 50 })
      .then((result) => {
        if (!cancelled) {
          setRooms(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("채팅방 목록을 불러오지 못했습니다.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">채팅방</h1>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!rooms && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> 불러오는 중...
        </div>
      )}

      {rooms?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          아직 만들어진 채팅방이 없습니다. 지도에서 방을 만들어보세요.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {rooms?.map((room) => (
          <li
            key={room.id}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{room.name ?? room.id}</p>
              <p className="text-xs text-muted-foreground">
                {room.userCount}명 접속 중
              </p>
            </div>
            <Button
              size="sm"
              render={<Link href={`/chatroom/${room.id}`} />}
              nativeButton={false}
            >
              입장
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
