"use client";

import { useSyncExternalStore } from "react";

import {
  getServerNicknameSnapshot,
  getStoredNickname,
  subscribeNickname,
} from "./nickname-store";

// localStorage는 컴포넌트 바깥의 외부 시스템이라 useSyncExternalStore로
// 구독한다. useEffect에서 읽어 setState하면 SSR 결과와 클라이언트 첫
// 렌더가 같아야 하는데, 그 사이에 불필요한 재렌더링이 한 번 더 생긴다.
//
// 반환값이 undefined면 아직 확정되지 않은 상태(서버 렌더링/하이드레이션
// 중)이고, ""(빈 문자열)이면 확정됐지만 저장된 닉네임이 없다는 뜻이다.
export function useStoredNickname() {
  return useSyncExternalStore(
    subscribeNickname,
    getStoredNickname,
    getServerNicknameSnapshot
  );
}
