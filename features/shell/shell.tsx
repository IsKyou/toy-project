"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/about", label: "소개" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [clickCount, setClickCount] = useState(0);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-3">
        <nav className="flex items-center gap-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                pathname === item.href && "text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setClickCount((count) => count + 1)}
        >
          클릭 {clickCount}회 (화면 이동해도 유지됩니다)
        </Button>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
