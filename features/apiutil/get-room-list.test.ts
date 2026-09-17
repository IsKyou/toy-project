import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { getRoomList, RoomListError } from "./get-room-list";

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

test("성공 응답이면 rooms 배열을 그대로 반환한다", async () => {
  const rooms = [
    { id: "general", type: "named", name: "general", userCount: 3, isActive: true },
  ];
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify({ success: true, rooms }), { status: 200 })
  );

  await expect(getRoomList()).resolves.toEqual(rooms);
});

test("limit과 type을 쿼리 파라미터로 전달한다", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify({ success: true, rooms: [] }), { status: 200 })
  );

  await getRoomList({ limit: 10, type: "named" });

  const requestUrl = vi.mocked(fetch).mock.calls[0]?.[0] as URL;
  expect(requestUrl.searchParams.get("limit")).toBe("10");
  expect(requestUrl.searchParams.get("type")).toBe("named");
});

test("success: false 응답이면 서버 에러 메시지로 예외를 던진다", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify({ success: false, error: "boom" }), {
      status: 200,
    })
  );

  const error = await getRoomList().catch((thrown) => thrown);
  expect(error).toBeInstanceOf(RoomListError);
  expect((error as Error).message).toBe("boom");
});

test("HTTP 상태가 실패면 예외를 던진다", async () => {
  vi.mocked(fetch).mockResolvedValue(
    new Response("", { status: 500 })
  );

  await expect(getRoomList()).rejects.toThrow(RoomListError);
});
