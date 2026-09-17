"use client";

import { useSyncExternalStore } from "react";

import {
  getNavigationGuardSnapshot,
  getServerNavigationGuardSnapshot,
  subscribeNavigationGuard,
} from "./navigation-guard-store";

// 현재 등록된 나가기 확인 가드를 읽는다. null이면 확인 없이 자유롭게
// 이동해도 된다는 뜻이다.
export function useNavigationGuard() {
  return useSyncExternalStore(
    subscribeNavigationGuard,
    getNavigationGuardSnapshot,
    getServerNavigationGuardSnapshot
  );
}
