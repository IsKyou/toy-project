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

// 캐릭터 이동 스냅샷/실시간 브로드캐스트. 배경의 GameWorld가 이걸로
// 다른 참여자의 캐릭터를 움직인다.
//
// posX/posY 외에는 서버가 없으면 기본값으로 채우기 때문에 전부 선택값이다.
// 속도·가속이 하나도 없으면 "이미 지나간 마지막 위치" 스냅샷이라는 뜻이고,
// 있으면 그 시점의 운동 상태를 그대로 이어서 재생하라는 뜻이다.
export interface RealtimeUserActionPayload {
  userName: string;
  posX: number;
  posY: number;
  veloX?: number;
  veloY?: number;
  accX?: number;
  accY?: number;
  seq?: number;
  [key: string]: unknown;
}

// 이동을 보낼 때 쓰는 봉투. 서버는 actionData를 고정 화이트리스트로 다시
// 조립하므로 여기 없는 필드를 넣어도 조용히 버려진다. userName도 서버가
// 세션 이름으로 덮어쓰기 때문에 클라이언트가 채워 보낼 필요가 없다.
export interface OutgoingUserAction {
  messageType: "realtime-useraction";
  actionData: {
    posX: number;
    posY: number;
    veloX: number;
    veloY: number;
    accX: number;
    accY: number;
    seq: number;
  };
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
  | { messageType: "ping" }
  | OutgoingUserAction;

// http(s) 베이스 URL을 ws(s) 엔드포인트로 바꾼다.
export function toWebSocketUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/^http/, "ws")}${path}`;
}
