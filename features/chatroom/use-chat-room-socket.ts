"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { API_BASE_URL } from "@/features/apiutil";

import type { IncomingRoomEvent } from "./protocol";
import { toWebSocketUrl } from "./protocol";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "closed"
  | "error";

export interface ChatEntry {
  id: string;
  kind: "chat" | "system" | "error";
  name?: string;
  text: string;
  timestamp: number;
  self?: boolean;
}

const PING_INTERVAL_MS = 15_000;

let entryIdCounter = 0;
function nextEntryId() {
  entryIdCounter += 1;
  return `entry-${entryIdCounter}`;
}

export function useChatRoomSocket(roomId: string) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  // 서버가 현재 전체 참여자 목록을 따로 내려주지 않아서, 이 접속이 살아있는
  // 동안 받은 ready(나)/joined/quit 이벤트만으로 조합한다. 즉 내가 접속하기
  // 전부터 있던 사람은 그 사람이 별도 행동(퇴장 등)을 하기 전까지 목록에
  // 안 뜬다.
  const [participants, setParticipants] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const usernameRef = useRef<string | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const appendEntry = useCallback((entry: Omit<ChatEntry, "id">) => {
    setEntries((prev) => [...prev, { ...entry, id: nextEntryId() }]);
  }, []);

  const addParticipant = useCallback((name: string) => {
    setParticipants((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }, []);

  const removeParticipant = useCallback((name: string) => {
    setParticipants((prev) => prev.filter((entry) => entry !== name));
  }, []);

  const join = useCallback(
    (username: string) => {
      if (wsRef.current) {
        return;
      }
      usernameRef.current = username;
      setStatus("connecting");

      const ws = new WebSocket(
        toWebSocketUrl(API_BASE_URL, `/api/room/${roomId}/websocket`)
      );
      wsRef.current = ws;

      ws.onopen = () => {
        // 가이드: 접속 후 첫 메시지는 반드시 이름 등록이어야 한다.
        ws.send(JSON.stringify({ name: username }));
        pingTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ messageType: "ping" }));
          }
        }, PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        let data: IncomingRoomEvent;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if ("ready" in data && data.ready) {
          setStatus("ready");
          if (usernameRef.current) {
            addParticipant(usernameRef.current);
          }
          return;
        }
        // 백로그(과거 메시지)는 type 필드 없이 id/createdAt과 함께 원본
        // 그대로 온다. 실시간 chat_message와 최상위 구조가 달라서 따로
        // 분기하지 않으면 재접속 직후 과거 대화가 안 보인다. 이 프로토콜의
        // 다른 어떤 프레임도 id 필드를 쓰지 않아 이것만으로 판별 가능하다.
        if ("id" in data) {
          appendEntry({
            kind: "chat",
            name: data.name,
            text: data.message,
            timestamp: data.timestamp,
            self: data.name === usernameRef.current,
          });
          return;
        }
        if ("joined" in data) {
          addParticipant(data.joined);
          appendEntry({
            kind: "system",
            text: `${data.joined}님이 입장했습니다.`,
            timestamp: Date.now(),
          });
          return;
        }
        if ("quit" in data) {
          removeParticipant(data.quit);
          appendEntry({
            kind: "system",
            text: `${data.quit}님이 퇴장했습니다.`,
            timestamp: Date.now(),
          });
          return;
        }
        if ("type" in data && data.type === "chat_message") {
          const payload = data.message;
          appendEntry({
            kind: "chat",
            name: payload.name,
            text: payload.message,
            timestamp: payload.timestamp,
            self: payload.name === usernameRef.current,
          });
          return;
        }
        if ("type" in data && data.type === "pong") {
          return;
        }
        // 캐릭터 이동 브로드캐스트. 이 화면은 캐릭터를 렌더링하지 않으므로
        // 의도적으로 무시한다.
        if ("type" in data && data.type === "realtime_useraction") {
          return;
        }
        if ("error" in data) {
          // 레이트리밋처럼 연결은 유지된 채 그 메시지만 거절되는 에러도
          // 있어서(가이드 4·6절), 여기서는 상태를 바꾸지 않는다. 실제로
          // 연결이 끊기는지는 onclose의 종료 코드로만 판단한다.
          appendEntry({ kind: "error", text: data.error, timestamp: Date.now() });
        }
      };

      ws.onclose = (event) => {
        if (pingTimerRef.current) {
          clearInterval(pingTimerRef.current);
          pingTimerRef.current = null;
        }
        // 1009: 이름 32자 초과, 1011: 레이트리미터 오류/하트비트 타임아웃 등.
        // 그 외(1000 포함)는 정상 종료 또는 동일 이름 재접속으로 인한 종료.
        setStatus(event.code === 1009 || event.code === 1011 ? "error" : "closed");
        if (event.reason) {
          appendEntry({
            kind: "error",
            text: `연결이 종료됐습니다: ${event.reason}`,
            timestamp: Date.now(),
          });
        }
      };

      ws.onerror = () => {
        setStatus("error");
      };
    },
    [roomId, appendEntry, addParticipant, removeParticipant]
  );

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || wsRef.current?.readyState !== WebSocket.OPEN) {
      return;
    }
    wsRef.current.send(JSON.stringify({ message: trimmed }));
  }, []);

  // 연결을 닫는다(= 서버에 퇴장 신호가 간다). 언마운트 시 자동으로도
  // 호출되지만, 사용자가 직접 "나가기"를 확정했을 때도 같은 로직을 쓴다.
  const leave = useCallback(() => {
    wsRef.current?.close();
    // StrictMode 개발 모드는 mount→cleanup→재mount를 한 번 시뮬레이션
    // 한다. wsRef를 null로 되돌리지 않으면 재mount 이후의 join()이
    // "이미 연결됨" 가드에 막혀, 방금 닫힌 소켓만 남고 새 연결이 열리지
    // 않는다.
    wsRef.current = null;
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return leave;
  }, [leave]);

  return { status, entries, participants, join, sendMessage, leave };
}
