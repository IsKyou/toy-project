"use client";

import { SendIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
  const { status, entries, join, sendMessage } = useChatRoomSocket(roomId);
  const [username, setUsername] = useState("");
  const [joinedAs, setJoinedAs] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      return;
    }
    setJoinedAs(trimmed);
    join(trimmed);
  }

  function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) {
      return;
    }
    sendMessage(draft);
    setDraft("");
  }

  if (!joinedAs) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <form onSubmit={handleJoin} className="w-full max-w-xs">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="username">닉네임</FieldLabel>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="닉네임을 입력하세요"
                maxLength={32}
                autoFocus
              />
            </Field>
            <Button type="submit" disabled={!username.trim()}>
              입장
            </Button>
          </FieldGroup>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
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
                          entry.kind === "error" ? "text-destructive" : undefined
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
  );
}
