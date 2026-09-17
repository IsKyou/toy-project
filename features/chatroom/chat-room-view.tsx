"use client";

import { SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

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

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ChatRoomView({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { status, entries, participants, join, sendMessage, leave } =
    useChatRoomSocket(roomId);
  const storedNickname = useStoredNickname();
  const [draft, setDraft] = useState("");

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
    <div className="flex flex-1 gap-6 p-6">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">{roomId}</h1>
          <Badge variant={STATUS_BADGE_VARIANT[status]}>
            {STATUS_LABEL[status]}
          </Badge>
        </div>

        <MessageScrollerProvider autoScroll>
          <MessageScroller className="h-[50vh] rounded-md border border-border">
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

        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="메시지를 입력하세요"
            disabled={status !== "ready"}
          />
          <Button type="submit" disabled={status !== "ready" || !draft.trim()}>
            <SendIcon data-icon="inline-start" />
            전송
          </Button>
        </form>
      </div>

      <aside className="hidden w-48 shrink-0 flex-col gap-3 sm:flex">
        <h2 className="text-sm font-medium text-muted-foreground">
          참여자 {participants.length}명
        </h2>
        <ul className="flex flex-col gap-1">
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
  );
}
