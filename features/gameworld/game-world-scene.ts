import Phaser from "phaser";

import {
  AIR_ACCELERATION_X,
  AIR_MAX_VELOCITY_X,
  BODY_RADIUS,
  GROUND_DRAG_X,
  HOP_VELOCITY_X,
  HOP_VELOCITY_Y,
  SPEECH_DURATION_MS,
  SPEECH_MAX_LENGTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import { createSendGate, createSeqTracker } from "./movement-protocol";
import type { MoveCommand, PlayerUpsert } from "./types";

const FONT_FAMILY =
  "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

const GROUND_Y = WORLD_HEIGHT - 80;

interface PlayerEntry {
  name: string;
  isMe: boolean;
  container: Phaser.GameObjects.Container;
  body: Phaser.Physics.Arcade.Body;
  speech: Phaser.GameObjects.Container;
  speechBubble: Phaser.GameObjects.Rectangle;
  speechText: Phaser.GameObjects.Text;
  speechTimer: Phaser.Time.TimerEvent | null;
}

// 이름에서 캐릭터 색을 정한다. 같은 사람은 누구 화면에서든 같은 색이다.
function colorFromName(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  }
  return Phaser.Display.Color.HSLToColor(hash / 360, 0.62, 0.58).color;
}

export interface GameWorldSceneCallbacks {
  onMove: (command: MoveCommand) => void;
  onReady: () => void;
}

export class GameWorldScene extends Phaser.Scene {
  static readonly KEY = "game-world";
  // 이 키들은 눌러도 페이지가 스크롤되지 않게 가로챈다. 스페이스는 버튼
  // 조작에 쓰이므로 넣지 않는다.
  private static readonly CAPTURED_KEYS = "LEFT,RIGHT,UP";

  private readonly players = new Map<string, PlayerEntry>();
  private readonly sendGate = createSendGate();
  private readonly seqTracker = createSeqTracker();
  private readonly callbacks: GameWorldSceneCallbacks;

  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private me: PlayerEntry | null = null;
  private inputEnabled = true;
  // 움직이는 동안 true. 멈춘 직후 마지막 좌표를 한 번 더 보내기 위한 표시로,
  // 이게 없으면 상대 화면에서 캐릭터가 마지막 패킷 위치에 어긋난 채 선다.
  private hasUnsentStop = false;

  constructor(callbacks: GameWorldSceneCallbacks) {
    super(GameWorldScene.KEY);
    this.callbacks = callbacks;
  }

  create() {
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, GROUND_Y + BODY_RADIUS);
    this.drawGround();

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      keyboard.addCapture(GameWorldScene.CAPTURED_KEYS);
    }

    this.callbacks.onReady();
  }

  update(time: number) {
    if (!this.me) {
      return;
    }
    this.applyInput(this.me);
    // 입력을 반영한 직후에 캡처한다. 물리가 먼저 돌면 가속이 이미 소비돼
    // 받는 쪽이 같은 궤적을 재현할 수 없다.
    this.maybeSendMove(this.me, time);
    this.syncSpeechDepth();
  }

  // --- 바깥에서 부르는 명령 -------------------------------------------------

  setMe(name: string) {
    if (this.me?.name === name) {
      return;
    }
    const entry = this.ensurePlayer(name);
    entry.isMe = true;
    this.me = entry;
  }

  upsertPlayer(input: PlayerUpsert) {
    const entry = this.ensurePlayer(input.name);
    // 내 캐릭터는 로컬 입력이 권위다. 서버가 되돌려준 내 좌표를 다시
    // 적용하면 고무줄처럼 튄다.
    if (entry.isMe) {
      return;
    }

    if (input.move) {
      const { seq } = input.move;
      if (seq !== undefined && !this.seqTracker.accept(input.name, seq)) {
        return;
      }
      const { posX, posY, veloX, veloY, accX, accY } = input.move;
      entry.body.reset(posX, posY);
      entry.body.setVelocity(veloX, veloY);
      entry.body.setAcceleration(accX, accY);
      return;
    }

    // 속도·가속이 없는 위치 스냅샷이다. 이미 지나간 이동이라 재생하지 않고
    // 그 자리에 세워둔다.
    entry.body.reset(input.posX, input.posY);
    entry.body.setAcceleration(0, 0);
  }

  removePlayer(name: string) {
    const entry = this.players.get(name);
    if (!entry) {
      return;
    }
    entry.speechTimer?.remove();
    entry.container.destroy(true);
    this.players.delete(name);
    this.seqTracker.forget(name);
    if (this.me?.name === name) {
      this.me = null;
    }
  }

  showSpeech(name: string, text: string) {
    const entry = this.players.get(name);
    // 그 이름의 캐릭터가 아직 없으면 조용히 무시한다. 접속 직후 도착하는
    // 과거 대화 백로그가 말풍선으로 한꺼번에 터지지 않는 건 이 덕분이다.
    if (!entry) {
      return;
    }

    const trimmed =
      text.length > SPEECH_MAX_LENGTH
        ? `${text.slice(0, SPEECH_MAX_LENGTH)}…`
        : text;
    entry.speechText.setText(trimmed);
    entry.speechBubble.setSize(
      entry.speechText.width + 20,
      entry.speechText.height + 12
    );
    entry.speech.setVisible(true);

    entry.speechTimer?.remove();
    entry.speechTimer = this.time.delayedCall(SPEECH_DURATION_MS, () => {
      entry.speech.setVisible(false);
      entry.speechTimer = null;
    });
  }

  // 채팅 입력창에 포커스가 있는 동안에는 방향키가 캐릭터를 움직이면 안 된다.
  setInputEnabled(enabled: boolean) {
    const keyboard = this.input.keyboard;
    if (!keyboard || this.inputEnabled === enabled) {
      return;
    }
    this.inputEnabled = enabled;
    keyboard.enabled = enabled;

    if (enabled) {
      keyboard.addCapture(GameWorldScene.CAPTURED_KEYS);
      return;
    }

    // 끈 동안에는 키 큐를 처리하지 않아 keyup을 놓친다. 눌린 채로 남은
    // 상태를 여기서 털어내지 않으면, 방향키를 누른 채 입력창을 클릭했다가
    // 빠져나왔을 때 아무도 누르지 않은 방향으로 캐릭터가 계속 뛴다.
    keyboard.resetKeys();
    // preventDefault는 게임 전역(KeyboardManager)에 걸려 있어서 이 플러그인의
    // enabled만 꺼서는 풀리지 않는다. 그대로 두면 채팅 입력창에서 좌우
    // 방향키로 커서를 옮길 수 없다.
    keyboard.removeCapture(GameWorldScene.CAPTURED_KEYS);
    this.me?.body.setAccelerationX(0);
  }

  // --- 내부 -----------------------------------------------------------------

  private drawGround() {
    const ground = this.add.rectangle(
      WORLD_WIDTH / 2,
      GROUND_Y + BODY_RADIUS + 4,
      WORLD_WIDTH,
      8,
      0x94a3b8,
      0.35
    );
    ground.setDepth(-1);
  }

  private applyInput(entry: PlayerEntry) {
    const cursors = this.cursors;
    if (!cursors) {
      return;
    }

    const body = entry.body;
    const left = cursors.left.isDown;
    const right = cursors.right.isDown;
    const onGround = body.blocked.down || body.touching.down;

    if (onGround) {
      body.setAccelerationX(0);
      if (left !== right) {
        // 좌우 방향키는 걷기가 아니라 그 방향으로의 점프다. 누르고 있으면
        // 착지할 때마다 다시 뛰어 깡충깡충 이동한다.
        body.setVelocity(left ? -HOP_VELOCITY_X : HOP_VELOCITY_X, HOP_VELOCITY_Y);
      } else if (cursors.up.isDown) {
        body.setVelocity(0, HOP_VELOCITY_Y);
      } else {
        body.setDragX(GROUND_DRAG_X);
      }
      return;
    }

    // 공중에서는 방향키로 약하게만 방향을 틀 수 있다.
    if (left !== right) {
      body.setAccelerationX(left ? -AIR_ACCELERATION_X : AIR_ACCELERATION_X);
    } else {
      body.setAccelerationX(0);
    }
  }

  private maybeSendMove(entry: PlayerEntry, time: number) {
    const body = entry.body;
    const moving =
      Math.abs(body.velocity.x) > 1 ||
      Math.abs(body.velocity.y) > 1 ||
      body.acceleration.x !== 0;

    // 가만히 서 있는 동안에는 아무것도 보내지 않는다. 멈춘 직후 한 번만
    // 최종 좌표를 알린다.
    if (!moving && !this.hasUnsentStop) {
      return;
    }
    if (!this.sendGate.canSend(time)) {
      return;
    }

    const seq = this.sendGate.issue(time);
    this.hasUnsentStop = moving;

    this.callbacks.onMove({
      // body.center가 이번 물리 스텝까지 반영된 좌표다. container.x는 아직
      // 지난 프레임 값이라 한 프레임씩 밀린다.
      posX: body.center.x,
      posY: body.center.y,
      veloX: body.velocity.x,
      veloY: body.velocity.y,
      accX: body.acceleration.x,
      accY: body.acceleration.y,
      seq,
    });
  }

  // 말풍선이 다른 캐릭터에 가리지 않도록, 말하는 중인 캐릭터를 앞으로 낸다.
  private syncSpeechDepth() {
    for (const entry of this.players.values()) {
      entry.container.setDepth(entry.speech.visible ? 10 : 0);
    }
  }

  private ensurePlayer(name: string): PlayerEntry {
    const existing = this.players.get(name);
    if (existing) {
      return existing;
    }

    const color = colorFromName(name);
    const spawnX = this.spawnXFor(name);
    const container = this.add.container(spawnX, GROUND_Y - 200);

    const bodyShape = this.add.circle(0, 0, BODY_RADIUS, color, 0.92);
    bodyShape.setStrokeStyle(2, 0xffffff, 0.8);

    const initial = this.add
      .text(0, 0, name.slice(0, 1), {
        fontFamily: FONT_FAMILY,
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const label = this.add
      .text(0, BODY_RADIUS + 10, name, {
        fontFamily: FONT_FAMILY,
        fontSize: "13px",
        color: "#ffffff",
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5, 0);

    const speechText = this.add
      .text(0, 0, "", {
        fontFamily: FONT_FAMILY,
        fontSize: "14px",
        color: "#0f172a",
      })
      .setOrigin(0.5);
    const speechBubble = this.add.rectangle(0, 0, 40, 26, 0xffffff, 0.95);
    speechBubble.setStrokeStyle(1, 0x0f172a, 0.2);
    const speech = this.add.container(0, -BODY_RADIUS - 26, [
      speechBubble,
      speechText,
    ]);
    speech.setVisible(false);

    container.add([speech, bodyShape, initial, label]);

    this.physics.add.existing(container);
    const body = container.body as Phaser.Physics.Arcade.Body;
    const size = BODY_RADIUS * 2;
    body.setSize(size, size, false);
    // Container의 원점은 (0,0)이고 바디 좌표는 좌상단 기준이라, 몸통 중심이
    // 원점에 오도록 반칸씩 당겨준다.
    body.setOffset(-BODY_RADIUS, -BODY_RADIUS);
    body.setCollideWorldBounds(true);
    body.setMaxVelocityX(AIR_MAX_VELOCITY_X);
    body.setDragX(GROUND_DRAG_X);

    const entry: PlayerEntry = {
      name,
      isMe: false,
      container,
      body,
      speech,
      speechBubble,
      speechText,
      speechTimer: null,
    };
    this.players.set(name, entry);
    return entry;
  }

  // 이름으로 시작 위치를 정해 여러 명이 한 점에 겹쳐 생기지 않게 한다.
  private spawnXFor(name: string) {
    let hash = 7;
    for (let index = 0; index < name.length; index += 1) {
      hash = (hash * 37 + name.charCodeAt(index)) % 1000;
    }
    const margin = 120;
    return margin + (hash / 1000) * (WORLD_WIDTH - margin * 2);
  }
}
