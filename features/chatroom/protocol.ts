// 실제 wss://.../api/room/{roomId}/websocket 연결과, 이후 제공된
// "채팅방 접속(WebSocket) API 사용 가이드"를 함께 반영한 메시지 포맷.
export interface ChatMessagePayload {
  type: "chat";
  name: string;
  message: string;
  posX: number | null;
  posY: number | null;
  timestamp: number;
}

// 접속 직후 오는 과거 메시지 백로그(최대 100개). 실시간 chat_message와 달리
// type 필드가 없고, message가 객체가 아니라 문자열(내용 그 자체)이다.
export interface BacklogMessage {
  id: string;
  name: string;
  message: string;
  timestamp: number;
  createdAt: string;
}

// 캐릭터 이동 스냅샷/실시간 브로드캐스트. 이 앱은 캐릭터가 있는 화면이
// 아니라서 내용을 렌더링하지 않고 무시하지만, 타입은 구분해둔다.
export interface RealtimeUserActionPayload {
  userName: string;
  posX: number;
  posY: number;
  [key: string]: unknown;
}

export type IncomingRoomEvent =
  | BacklogMessage
  | { joined: string }
  | { quit: string }
  | { ready: true }
  | { type: "chat_message"; message: ChatMessagePayload }
  | { type: "realtime_useraction"; action: RealtimeUserActionPayload }
  | { type: "pong" }
  | { error: string };

export type OutgoingRoomEvent =
  | { name: string }
  | { message: string }
  | { messageType: "ping" };

// http(s) 베이스 URL을 ws(s) 엔드포인트로 바꾼다.
export function toWebSocketUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/^http/, "ws")}${path}`;
}
