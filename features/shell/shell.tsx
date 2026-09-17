"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useStoredNickname } from "@/features/identity";
import { useNavigationGuard } from "@/features/navigation-guard";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/userprofile", label: "프로필" },
  { href: "/map", label: "map" },
  { href: "/chatroom", label: "chatroom" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const nickname = useStoredNickname();
  const guard = useNavigationGuard();
  // 이동을 시도했는데 가드가 있어서 확인이 필요한 목적지. null이면 확인
  // 창이 닫혀있다는 뜻이다. window.confirm()은 이 앱이 실행되는 일부
  // 환경(임베드된 프리뷰 등)에서 조용히 억제돼 항상 false를 반환하기
  // 때문에, 직접 만든 다이얼로그로 대신한다.
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  function handleNavigate(
    event: { preventDefault: () => void },
    href: string
  ) {
    if (!guard) {
      return;
    }
    event.preventDefault();
    setPendingHref(href);
  }

  function handleConfirmLeave() {
    if (!pendingHref) {
      return;
    }
    guard?.onLeave();
    router.push(pendingHref);
    setPendingHref(null);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-3">
        <nav className="flex items-center gap-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onNavigate={(event) => handleNavigate(event, item.href)}
              className={cn(
                "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                pathname === item.href && "text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="text-sm text-muted-foreground">
          {nickname ? nickname : "프로필을 설정해주세요"}
        </span>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>

      {pendingHref && guard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-background p-5 shadow-lg">
            <p className="text-sm text-foreground">{guard.message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPendingHref(null)}
              >
                취소
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleConfirmLeave}
              >
                나가기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
