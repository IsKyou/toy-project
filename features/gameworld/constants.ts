// 논리 월드 크기는 고정한다. 참여자마다 화면 크기가 다른데 캔버스 픽셀을
// 그대로 좌표로 쓰면 같은 posX가 서로 다른 위치를 가리키게 된다. 캔버스는
// 이 크기를 FIT으로 축소해서 보여줄 뿐이고, 좌표계는 모두가 공유한다.
export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;

export const GRAVITY_Y = 2000;

// 캐릭터 몸통 반지름. 물리 바디도 이 크기의 정사각형으로 잡는다.
export const BODY_RADIUS = 22;

// 좌우 방향키를 누르면 그 방향으로 깡충 뛴다. 걷기가 아니라 점프다.
export const HOP_VELOCITY_X = 300;
export const HOP_VELOCITY_Y = -760;

// 공중에서는 방향키로 약하게만 방향을 틀 수 있다.
export const AIR_ACCELERATION_X = 600;
export const AIR_MAX_VELOCITY_X = 420;

// 착지 후 미끄러짐을 멈추는 감속.
export const GROUND_DRAG_X = 1600;

// 이동 전송 주기. 서버는 세션당 50ms 쓰로틀을 걸고 더 빨리 오면 거절한다.
// 80ms로도 네트워크 지터로 두 패킷이 몰려 도착해 거절당하는 일이 실제로
// 있어서, 여유를 더 두고 100ms로 잡았다.
export const SEND_INTERVAL_MS = 100;

// 말풍선이 머리 위에 떠 있는 시간.
export const SPEECH_DURATION_MS = 4000;

// 말풍선에 그대로 그리는 최대 글자 수. 넘으면 잘라서 보여준다.
export const SPEECH_MAX_LENGTH = 40;
