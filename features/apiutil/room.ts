export type RoomType = "private" | "named";

// GET /api/room/list 응답은 5개 필드로 축약돼 있다. createdAt 등 다른 필드가
// 필요하면 room-manager/list(관리자용) 엔드포인트를 따로 써야 한다.
export interface Room {
  id: string;
  type: RoomType;
  name: string | null;
  userCount: number;
  isActive: boolean;
}

export interface RoomListSuccessResponse {
  success: true;
  rooms: Room[];
}

export interface RoomListErrorResponse {
  success: false;
  error: string;
}

export type RoomListResponse = RoomListSuccessResponse | RoomListErrorResponse;

export interface CreateRoomParams {
  /** 기본값은 서버에서 'private'로 처리된다. */
  type?: RoomType;
  /** type: 'named'일 때 필수. 'private'에서는 서버가 무시한다. */
  name?: string | null;
  /** 지도상 X 좌표(선택). */
  posX?: number | null;
  /** 지도상 Y 좌표(선택). */
  posY?: number | null;
}

export interface CreateRoomSuccessResponse {
  roomId: string;
  // named 타입이어도 사람이 읽는 이름이 아니라 항상 64자리 hex다. 재접속에는
  // 이 값이 아니라 roomId를 써야 한다.
  durableObjectId: string;
  success: true;
}

export interface CreateRoomErrorResponse {
  success: false;
  error: string;
}

export type CreateRoomResponse =
  | CreateRoomSuccessResponse
  | CreateRoomErrorResponse;

export interface CreatedRoom {
  roomId: string;
  durableObjectId: string;
}
