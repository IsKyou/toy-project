import { SEND_INTERVAL_MS } from "./constants";

// 송신 게이트. 방향키를 누르고 있어도 매 프레임이 아니라 SEND_INTERVAL_MS
// 마다 한 번만 보낸다. seq는 여기서 발급하는 단조 증가값이다.
export function createSendGate() {
  let lastSentAt = Number.NEGATIVE_INFINITY;
  let seq = 0;

  return {
    canSend(now: number) {
      return now - lastSentAt >= SEND_INTERVAL_MS;
    },
    // 전송이 확정된 시점에만 호출한다. 게이트를 닫고 다음 seq를 내준다.
    issue(now: number) {
      lastSentAt = now;
      seq += 1;
      return seq;
    },
  };
}

export type SendGate = ReturnType<typeof createSendGate>;

// 수신한 이동 명령을 받아들일지 판단한다. WebSocket은 TCP라 순서가
// 뒤바뀌지 않지만, 재접속 직후 이전 연결의 패킷이 늦게 도착할 수 있다.
export function createSeqTracker() {
  const highWater = new Map<string, number>();

  return {
    accept(name: string, seq: number) {
      const previous = highWater.get(name);
      if (previous === undefined) {
        highWater.set(name, seq);
        return true;
      }
      // 같은 값이면 중복이므로 버린다.
      if (seq === previous) {
        return false;
      }
      // 고수위보다 작으면 상대가 quit 없이 재접속해 seq를 0부터 다시
      // 발급하기 시작했다는 뜻이다. 여기서 고수위를 그대로 들고 있으면
      // 그 값을 넘길 때까지 이동이 통째로 버려져 상대가 멈춘 것처럼 보인다.
      highWater.set(name, seq);
      return true;
    },
    forget(name: string) {
      highWater.delete(name);
    },
  };
}

export type SeqTracker = ReturnType<typeof createSeqTracker>;
