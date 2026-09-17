"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { API_BASE_URL } from "@/features/apiutil";

import type {
  IncomingRoomEvent,
  OutgoingUserAction,
  RealtimeUserActionPayload,
} from "./protocol";
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

// 채팅 로그와 달리 캐릭터 움직임은 React 상태로 들고 있을 이유가 없다.
// 프레임마다 리렌더가 돌면 화면이 버벅이므로, 받은 즉시 이 콜백으로
// 흘려보내고 그림은 받는 쪽이 자기 방식대로 그린다.
export interface ChatRoomSocketHandlers {
  onReady?: (username: string) => void;
  onQuit?: (name: string) => void;
  onChat?: (name: string, text: string) => void;
  onUserAction?: (action: RealtimeUserActionPayload) => void;
}

const PING_INTERVAL_MS = 15_000;

// 서버가 이동 쓰로틀(세션당 50ms)에 걸린 패킷을 거절할 때 보내는 문구.
const ACTION_THROTTLE_ERROR = "Please wait before sending another action";

let entryIdCounter = 0;
function nextEntryId() {
  entryIdCounter += 1;
  return `entry-${entryIdCounter}`;
}

export function useChatRoomSocket(
  roomId: string,
  handlers: ChatRoomSocketHandlers = {}
) {
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
  // 핸들러를 join()의 의존성에 넣으면 렌더마다 콜백이 새로 만들어질 때
  // 연결이 다시 맺어진다. 최신 값만 ref로 따라가게 둔다.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

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
            handlersRef.current.onReady?.(usernameRef.current);
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
          // 백로그는 ready보다 먼저 도착한다. 그 시점엔 캐릭터가 하나도
          // 없어서 이 호출이 조용히 무시되고, 덕분에 입장하자마자 과거
          // 대화가 전부 말풍선으로 터지지 않는다. 순서를 바꿀 때 주의할 것.
          handlersRef.current.onChat?.(data.name, data.message);
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
          handlersRef.current.onQuit?.(data.quit);
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
          // 내 메시지도 에코로 되돌아와서 말풍선이 뜬다. 이동과 달리
          // 채팅에는 자기 필터를 두지 않는다.
          handlersRef.current.onChat?.(payload.name, payload.message);
          return;
        }
        if ("type" in data && data.type === "pong") {
          return;
        }
        if ("type" in data && data.type === "realtime_useraction") {
          // 브로드캐스트는 발신자에게도 되돌아온다. 내 캐릭터는 로컬 입력이
          // 권위라서, 서버가 되돌려준 내 좌표를 다시 적용하면 고무줄처럼
          // 튄다. 그래서 내 에코는 여기서 버린다.
          if (data.action.userName !== usernameRef.current) {
            handlersRef.current.onUserAction?.(data.action);
          }
          return;
        }
        if ("error" in data) {
          // 이동 쓰로틀에 걸린 패킷은 사용자가 손쓸 수 있는 게 없고 다음
          // 패킷이 곧 이어져서 화면상 아무 문제도 생기지 않는다. 그걸
          // 채팅 로그에 빨갛게 띄우면 방향키를 누를 때마다 대화가 에러로
          // 덮인다. 서버가 코드를 주지 않아 메시지로 구분한다.
          if (data.error === ACTION_THROTTLE_ERROR) {
            return;
          }
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

  // 캐릭터 이동을 보낸다. 전송 주기 조절은 보내는 쪽(GameWorld)이 하므로
  // 여기서는 연결 상태만 확인하고 그대로 흘려보낸다.
  const sendUserAction = useCallback(
    (actionData: OutgoingUserAction["actionData"]) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        return;
      }
      wsRef.current.send(
        JSON.stringify({
          messageType: "realtime-useraction",
          actionData,
        } satisfies OutgoingUserAction)
      );
    },
    []
  );

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

  return {
    status,
    entries,
    participants,
    join,
    sendMessage,
    sendUserAction,
    leave,
  };
}
