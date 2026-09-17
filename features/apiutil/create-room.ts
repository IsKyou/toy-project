import { API_BASE_URL } from "./config";
import type { CreatedRoom, CreateRoomParams, CreateRoomResponse } from "./room";

export class CreateRoomError extends Error {}

export async function createRoom(
  params: CreateRoomParams = {},
  init?: RequestInit
): Promise<CreatedRoom> {
  const response = await fetch(new URL("/api/room", API_BASE_URL), {
    ...init,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    body: JSON.stringify(params),
  });

  // 가이드 4절: 실패 응답도 200이 아닌 400으로 오지만 본문 구조는 동일하게
  // { success, error }라서, 상태 코드와 무관하게 JSON을 먼저 파싱해 success로
  // 분기한다.
  let data: CreateRoomResponse;
  try {
    data = (await response.json()) as CreateRoomResponse;
  } catch {
    throw new CreateRoomError(
      `방을 생성하지 못했습니다. (HTTP ${response.status})`
    );
  }

  if (!data.success) {
    throw new CreateRoomError(data.error);
  }

  return { roomId: data.roomId, durableObjectId: data.durableObjectId };
}
