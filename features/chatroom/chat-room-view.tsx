"use client";

import { SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
import { GameWorld } from "@/features/gameworld";
import type { GameWorldHandle } from "@/features/gameworld";
import { useStoredNickname } from "@/features/identity";
import { setNavigationGuard } from "@/features/navigation-guard";

import type { ConnectionStatus } from "./use-chat-room-socket";
import { useChatRoomSocket } from "./use-chat-room-socket";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: "입장 전",
  connecting: "접속 중...",
  ready: "접속됨",
  closed: "연결 종료",
  error: "오류",
};

const STATUS_BADGE_VARIANT: Record<
  ConnectionStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  idle: "outline",
  connecting: "secondary",
  ready: "default",
  closed: "outline",
  error: "destructive",
};

// 글자를 만들지 않는 키들. 이것까지 점프로 치면 Shift를 누르고 있기만
// 해도 캐릭터가 뛴다.
const SILENT_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "Tab",
  "Escape",
]);

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 동적 라우트 세그먼트가 퍼센트 인코딩된 채로 넘어올 때가 있어(예:
// "여의도"가 "%EC%97%AC%EC%9D%98%EB%8F%84"로), 화면에 보여줄 때만 풀어서
// 보여준다. 소켓 연결 등 실제 식별자로 쓰는 roomId 자체는 그대로 둔다.
function decodeRoomIdForDisplay(roomId: string) {
  try {
    return decodeURIComponent(roomId);
  } catch {
    return roomId;
  }
}

export function ChatRoomView({ roomId }: { roomId: string }) {
  const router = useRouter();
  const gameRef = useRef<GameWorldHandle | null>(null);
  // 소켓은 이 화면이 소유하고, 게임은 소켓을 전혀 모른다. 받은 이벤트를
  // 여기서 게임 명령으로 번역하는 것이 둘 사이의 유일한 연결이다.
  const {
    status,
    entries,
    participants,
    join,
    sendMessage,
    sendUserAction,
    leave,
  } = useChatRoomSocket(roomId, {
    onReady: (name) => gameRef.current?.setMe(name),
    onQuit: (name) => gameRef.current?.removePlayer(name),
    onChat: (name, text) => gameRef.current?.showSpeech(name, text),
    onUserAction: (action) => {
      // 속도·가속이 하나라도 있으면 그 운동 상태를 이어서 재생하고, 전부
      // 없으면 이미 지나간 위치 스냅샷이라 그 자리에 세우기만 한다.
      const hasMotion = [
        action.veloX,
        action.veloY,
        action.accX,
        action.accY,
      ].some((value) => value != null);

      gameRef.current?.upsertPlayer({
        name: action.userName,
        posX: action.posX,
        posY: action.posY,
        move: hasMotion
          ? {
              posX: action.posX,
              posY: action.posY,
              veloX: action.veloX ?? 0,
              veloY: action.veloY ?? 0,
              accX: action.accX ?? 0,
              accY: action.accY ?? 0,
              seq: action.seq,
            }
          : undefined,
      });
    },
  });
  const storedNickname = useStoredNickname();
  const [draft, setDraft] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  // 게임 캔버스 하단을 채팅 로그 하단에서 얼마나 띄울지. 로그 높이가 vh
  // 단위라 창 크기에 따라 달라지고, 그 위의 제목줄 높이는 글꼴에 따라
  // 달라져서 CSS만으로는 계산할 수 없다.
  const [canvasBottom, setCanvasBottom] = useState(0);

  // 저장된 닉네임이 있으면 그 값으로 바로 입장하고, 없으면 프로필 화면으로
  // 보내 닉네임을 먼저 설정하게 한다. 저장 후에는 이 채팅방으로 되돌아온다.
  useEffect(() => {
    if (storedNickname === undefined) {
      // 아직 로컬 저장소 값이 확정되지 않았다(하이드레이션 중). 여기서
      // "닉네임 없음"으로 성급히 판단하면, 실제로는 저장돼 있는데도
      // 새로고침할 때마다 프로필로 잘못 튕겨나가게 된다.
      return;
    }
    if (storedNickname) {
      join(storedNickname);
      return;
    }
    router.push(
      `/userprofile?redirect=${encodeURIComponent(`/chatroom/${roomId}`)}`
    );
  }, [storedNickname, join, router, roomId]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const log = logRef.current;
    if (!root || !log) {
      return;
    }
    const measure = () => {
      setCanvasBottom(
        root.getBoundingClientRect().bottom - log.getBoundingClientRect().bottom
      );
    };
    measure();
    // 창 크기가 바뀌면 로그 높이(vh)와 바깥 높이가 함께 달라진다.
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(log);
    return () => observer.disconnect();
  }, [storedNickname]);

  // 접속을 시도 중이거나 이미 접속된 동안에는 상단 탭으로 이동하기 전에
  // 확인을 받는다. 확인하면 leave()로 소켓을 닫아 서버에 퇴장 신호를 보낸
  // 뒤 이동이 이어진다.
  useEffect(() => {
    if (status !== "connecting" && status !== "ready") {
      return;
    }
    setNavigationGuard({
      message: "채팅방을 나가시겠어요? 나가면 채팅방에서 퇴장합니다.",
      onLeave: leave,
    });
    return () => setNavigationGuard(null);
  }, [status, leave]);

  // 채팅을 치는 동안 내 캐릭터가 타건에 맞춰 통통 뛴다. 입력창에 포커스가
  // 있으면 방향키 조작은 꺼져 있으므로, 이 경로로만 점프가 발동한다.
  function handleDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (SILENT_KEYS.has(event.key)) {
      return;
    }
    gameRef.current?.jump();
  }

  function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }
    sendMessage(draft);
    setDraft("");
  }

  if (!storedNickname) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
        <Spinner />
        <p>입장을 준비하고 있습니다...</p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative flex flex-1 flex-col">
      {/* 채팅 UI 뒤에 깔리는 게임 레이어. 클릭은 통과시키고 방향키만 받는다.
          캔버스는 월드와 같은 종횡비를 유지하며 가로를 꽉 채우므로, 이
          상자의 하단을 채팅 로그 하단에 붙이면 지면도 거기에 맞는다. 창
          크기가 바뀌어도 캔버스가 통째로 같은 비율로 늘고 줄어든다. */}
      <div
        className="pointer-events-none absolute inset-x-0 overflow-hidden"
        style={{ bottom: canvasBottom }}
      >
        <GameWorld
          ref={gameRef}
          onMove={sendUserAction}
          className="w-full"
        />
      </div>

      {/* 게임 레이어는 화면 전체를 덮어야 하지만 이 줄은 콘텐츠 높이만
          차지해야 한다. 그래야 참여자 패널이 늘어나는 기준이 남은 화면이
          아니라 왼쪽 컬럼이 되어, 두 하단이 같은 높이에서 끝난다. */}
      <div className="relative flex p-6">
        {/* 오른쪽 여백은 참여자 패널 너비(w-48)와 그 사이 간격을 합한
            값이다. 패널을 absolute로 띄웠기 때문에 gap으로는 자리를
            비워둘 수 없다. */}
        <div className="flex flex-1 flex-col gap-4 sm:pr-54">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">
              {decodeRoomIdForDisplay(roomId)}
            </h1>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground sm:inline">
                방향키로 캐릭터를 움직일 수 있습니다
              </span>
              <Badge variant={STATUS_BADGE_VARIANT[status]}>
                {STATUS_LABEL[status]}
              </Badge>
            </div>
          </div>

          <div ref={logRef}>
            <MessageScrollerProvider autoScroll>
              <MessageScroller className="h-[46vh] rounded-md border border-border">
                <MessageScrollerViewport>
                  <MessageScrollerContent className="p-4">
                    {entries.map((entry) => (
                      <MessageScrollerItem key={entry.id} messageId={entry.id}>
                        {entry.kind === "chat" ? (
                          <Message align={entry.self ? "end" : "start"}>
                            <MessageContent>
                              <MessageHeader>{entry.name}</MessageHeader>
                              <Bubble
                                align={entry.self ? "end" : "start"}
                                variant={entry.self ? "default" : "secondary"}
                              >
                                <BubbleContent>{entry.text}</BubbleContent>
                              </Bubble>
                              <MessageFooter>
                                {formatTime(entry.timestamp)}
                              </MessageFooter>
                            </MessageContent>
                          </Message>
                        ) : (
                          <Marker variant="separator">
                            <MarkerContent
                              className={
                                entry.kind === "error"
                                  ? "text-destructive"
                                  : undefined
                              }
                            >
                              {entry.text}
                            </MarkerContent>
                          </Marker>
                        )}
                      </MessageScrollerItem>
                    ))}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
          </div>

          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder="메시지를 입력하세요"
              disabled={status !== "ready"}
            />
            <Button type="submit" disabled={status !== "ready" || !draft.trim()}>
              <SendIcon data-icon="inline-start" />
              전송
            </Button>
          </form>
        </div>

        {/* 흐름에서 빼내야 이 패널이 줄 높이를 결정하지 못한다. 흐름에
            두면 참여자가 많을 때 패널이 스스로 늘어나고 그만큼 줄도
            늘어나서, 목록이 스크롤되는 대신 입력창 아래까지 자란다. */}
        <aside className="absolute inset-y-6 right-6 hidden w-48 flex-col gap-3 rounded-md border border-border bg-background/70 p-3 backdrop-blur-sm sm:flex">
          <h2 className="text-sm font-medium text-muted-foreground">
            참여자 {participants.length}명
          </h2>
          {/* 참여자가 많아도 이 패널이 왼쪽 컬럼보다 길어지지 않도록,
              넘치는 만큼은 목록 안에서 스크롤한다. */}
          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {participants.map((name) => (
              <li
                key={name}
                className="flex items-center gap-2 truncate text-sm"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="truncate">
                  {name}
                  {name === storedNickname && (
                    <span className="text-muted-foreground"> (나)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
