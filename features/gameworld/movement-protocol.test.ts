import { describe, expect, it } from "vitest";

import { SEND_INTERVAL_MS } from "./constants";
import { createSendGate, createSeqTracker } from "./movement-protocol";

describe("createSendGate", () => {
  it("첫 전송은 바로 통과시킨다", () => {
    const gate = createSendGate();
    expect(gate.canSend(0)).toBe(true);
  });

  it("전송 주기가 지나기 전에는 막고, 지나면 다시 연다", () => {
    const gate = createSendGate();
    gate.issue(1000);

    expect(gate.canSend(1000 + SEND_INTERVAL_MS - 1)).toBe(false);
    expect(gate.canSend(1000 + SEND_INTERVAL_MS)).toBe(true);
  });

  it("seq를 1부터 단조 증가로 발급한다", () => {
    const gate = createSendGate();

    expect(gate.issue(0)).toBe(1);
    expect(gate.issue(100)).toBe(2);
    expect(gate.issue(200)).toBe(3);
  });
});

describe("createSeqTracker", () => {
  it("처음 보는 이름은 받아들인다", () => {
    const tracker = createSeqTracker();
    expect(tracker.accept("홍길동", 7)).toBe(true);
  });

  it("고수위보다 큰 seq는 받아들인다", () => {
    const tracker = createSeqTracker();
    tracker.accept("홍길동", 7);
    expect(tracker.accept("홍길동", 8)).toBe(true);
  });

  it("같은 seq가 다시 오면 중복으로 버린다", () => {
    const tracker = createSeqTracker();
    tracker.accept("홍길동", 7);
    expect(tracker.accept("홍길동", 7)).toBe(false);
  });

  it("seq가 작아지면 송신측 재시작으로 보고 고수위를 리셋한다", () => {
    const tracker = createSeqTracker();
    tracker.accept("홍길동", 50);

    // 상대가 quit 없이 재접속해 seq가 1부터 다시 시작한 경우.
    expect(tracker.accept("홍길동", 1)).toBe(true);
    expect(tracker.accept("홍길동", 2)).toBe(true);
  });

  it("이름별로 고수위를 따로 관리한다", () => {
    const tracker = createSeqTracker();
    tracker.accept("홍길동", 10);
    expect(tracker.accept("김철수", 1)).toBe(true);
  });

  it("퇴장한 이름을 잊으면 다시 처음부터 받아들인다", () => {
    const tracker = createSeqTracker();
    tracker.accept("홍길동", 10);
    tracker.forget("홍길동");
    expect(tracker.accept("홍길동", 10)).toBe(true);
  });
});
