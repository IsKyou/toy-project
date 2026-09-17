"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { saveNickname, useStoredNickname } from "@/features/identity";

const DEFAULT_NICKNAME = "익명";

export function UserProfileView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 외부(예: chatroom)로 돌아갈 경로만 허용한다. 내부 경로가 아니면
  // 무시해 열린 리다이렉트로 악용되지 않게 한다.
  const rawRedirect = searchParams.get("redirect");
  const redirectTo = rawRedirect?.startsWith("/") ? rawRedirect : null;

  // 하이드레이션이 끝나기 전(undefined)에는 빈 문자열로 취급해 보여준다.
  // 곧이어 실제 값으로 재렌더링된다.
  const nickname = useStoredNickname() ?? "";
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

    if (redirectTo) {
      router.push(redirectTo);
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
          {redirectTo && (
            <p className="text-sm text-muted-foreground">
              채팅방에 입장하려면 닉네임이 필요합니다. 저장하면 이어서
              입장합니다.
            </p>
          )}
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
              이 브라우저에만 저장되는 닉네임입니다. chatroom 입장 시 자동으로
              쓰입니다.
            </FieldDescription>
          </Field>
          <Button type="submit" disabled={!value.trim()}>
            {redirectTo ? "저장하고 입장" : "저장"}
          </Button>
        </FieldGroup>
      </form>
    </div>
  );
}
