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
