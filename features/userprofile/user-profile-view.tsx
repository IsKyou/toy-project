"use client";

import { type FormEvent, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";

const NICKNAME_STORAGE_KEY = "userprofile:nickname";
const DEFAULT_NICKNAME = "익명";

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getServerSnapshot() {
  return "";
}

function saveNickname(value: string) {
  window.localStorage.setItem(NICKNAME_STORAGE_KEY, value);
  notifyListeners();
}

export function UserProfileView() {
  // localStorage는 컴포넌트 바깥의 외부 시스템이라 useSyncExternalStore로
  // 구독한다. useEffect에서 읽어 setState하면 SSR 결과와 클라이언트 첫
  // 렌더가 같아야 하는데, 그 사이에 불필요한 재렌더링이 한 번 더 생긴다.
  const nickname = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  // null이면 "아직 사용자가 입력을 건드리지 않음"을 뜻하고, 이때 입력값은
  // 저장된 닉네임을 그대로 따라간다.
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? nickname;

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();

    try {
      saveNickname(trimmed);
    } catch {
      toast.add({
        title: "저장에 실패했습니다.",
        description: "브라우저 저장소를 사용할 수 없습니다.",
        type: "error",
      });
      return;
    }

    setDraft(null);
    toast.add({ title: "프로필을 저장했습니다.", type: "success" });
  }

  const displayName = nickname || DEFAULT_NICKNAME;
  const initial = displayName.trim().charAt(0).toUpperCase();

  return (
    <div className="flex flex-1 flex-col items-center gap-8 px-6 py-16">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-20 items-center justify-center rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
          {initial}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {displayName}
        </h1>
      </div>

      <form onSubmit={handleSave} className="w-full max-w-xs">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="nickname">닉네임</FieldLabel>
            <Input
              id="nickname"
              value={value}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="닉네임을 입력하세요"
              maxLength={32}
              autoFocus
            />
            <FieldDescription>
              이 브라우저에만 저장되는 닉네임입니다.
            </FieldDescription>
          </Field>
          <Button type="submit" disabled={!value.trim()}>
            저장
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
