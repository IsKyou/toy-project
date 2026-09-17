import { API_BASE_URL } from "./config";
import type { Room, RoomListResponse, RoomType } from "./room";

export class RoomListError extends Error {}

export interface GetRoomListParams {
  /** 반환할 최대 개수. 서버 기본값은 20. */
  limit?: number;
  /** 'private' 또는 'named'로 필터. 생략하면 전체. */
  type?: RoomType;
  // 서버는 정렬을 lastActivity desc로 고정하고 sortBy/order 쿼리를 조용히
  // 무시하므로(가이드 2절), 여기서도 옵션으로 노출하지 않는다.
}

export async function getRoomList(
  params: GetRoomListParams = {},
  init?: RequestInit
): Promise<Room[]> {
  const url = new URL("/api/room/list", API_BASE_URL);
  if (params.limit !== undefined) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params.type) {
    url.searchParams.set("type", params.type);
  }

  const response = await fetch(url, init);
  if (!response.ok) {
    throw new RoomListError(
      `채팅방 목록을 불러오지 못했습니다. (HTTP ${response.status})`
    );
  }

  const data = (await response.json()) as RoomListResponse;
  if (!data.success) {
    throw new RoomListError(data.error);
  }

  // 빈 배열이 방이 없다는 뜻은 아닐 수 있다(가이드 5절: KV 미바인딩/최종 일관성).
  return data.rooms;
}
