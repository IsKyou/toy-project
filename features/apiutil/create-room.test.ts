import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { createRoom, CreateRoomError } from "./create-room";

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

test("성공 응답이면 roomId와 durableObjectId를 반환한다", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        roomId: "my-cool-room",
        durableObjectId: "a".repeat(64),
        success: true,
      }),
      { status: 200 }
    )
  );

  await expect(createRoom({ type: "named", name: "my-cool-room" })).resolves.toEqual({
    roomId: "my-cool-room",
    durableObjectId: "a".repeat(64),
  });
});

test("POST로 body에 파라미터를 그대로 담아 보낸다", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(
      JSON.stringify({ roomId: "r", durableObjectId: "d", success: true }),
      { status: 200 }
    )
  );

  await createRoom({ type: "named", name: "room", posX: 1, posY: 2 });

  const [, requestInit] = vi.mocked(fetch).mock.calls[0] as [URL, RequestInit];
  expect(requestInit.method).toBe("POST");
  expect(JSON.parse(requestInit.body as string)).toEqual({
    type: "named",
    name: "room",
    posX: 1,
    posY: 2,
  });
});

test("파라미터를 생략하면 빈 객체를 보낸다(서버 기본값 'private')", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(
      JSON.stringify({ roomId: "r", durableObjectId: "d", success: true }),
      { status: 200 }
    )
  );

  await createRoom();

  const [, requestInit] = vi.mocked(fetch).mock.calls[0] as [URL, RequestInit];
  expect(JSON.parse(requestInit.body as string)).toEqual({});
});

test("success: false 응답이면(예: 이름 32자 초과) 서버 에러 메시지로 예외를 던진다", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        success: false,
        error: "Room name too long (max 32 characters)",
      }),
      { status: 400 }
    )
  );

  const error = await createRoom({ type: "named", name: "x".repeat(33) }).catch(
    (thrown) => thrown
  );
  expect(error).toBeInstanceOf(CreateRoomError);
  expect((error as Error).message).toBe(
    "Room name too long (max 32 characters)"
  );
});

test("JSON으로 파싱할 수 없는 응답이면 HTTP 상태를 담아 예외를 던진다", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response("not json", { status: 502 }));

  await expect(createRoom()).rejects.toThrow(CreateRoomError);
});
