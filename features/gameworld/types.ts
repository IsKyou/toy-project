// 서버로 오가는 이동 명령. 위치만이 아니라 속도·가속을 함께 싣기 때문에,
// 받는 쪽은 이 값을 주입한 뒤 같은 물리로 직접 전진 시뮬레이션할 수 있다
// (dead reckoning). 그래서 80ms에 한 번만 보내도 캐릭터가 부드럽게 움직인다.
export interface MoveCommand {
  posX: number;
  posY: number;
  veloX: number;
  veloY: number;
  accX: number;
  accY: number;
  seq: number;
}

// 다른 참여자의 상태를 반영할 때 쓰는 입력. move가 있으면 재생(포물선을
// 그대로 이어서 그린다), 없으면 위치만 스냅한다. 후자는 새로 입장했을 때
// 서버가 보내주는 "마지막으로 알려진 위치" 스냅샷이다. 이미 지나간 이동
// 명령이라 재생하면 과거 이동이 다시 재생돼 캐릭터가 엉뚱하게 움직인다.
export interface PlayerUpsert {
  name: string;
  posX: number;
  posY: number;
  move?: RemoteMove;
}

// 받은 이동 명령. seq는 보내는 쪽 구현에 따라 없을 수도 있어서 선택값이다.
// 없으면 중복·순서 판정을 건너뛰고 그대로 받아들인다.
export interface RemoteMove extends Omit<MoveCommand, "seq"> {
  seq?: number;
}

// GameWorld가 바깥에 노출하는 전부. 이 월드는 WebSocket을 전혀 모르고,
// 이 명령형 API와 onMove 콜백으로만 바깥과 이어진다. 덕분에 네트워크 없이
// 단독으로도 구동할 수 있다.
export interface GameWorldHandle {
  setMe(name: string): void;
  jump(): void;
  upsertPlayer(player: PlayerUpsert): void;
  removePlayer(name: string): void;
  showSpeech(name: string, text: string): void;
}
