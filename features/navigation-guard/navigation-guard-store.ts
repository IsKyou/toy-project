// 상단 셸의 탭 이동과 채팅방처럼 서로 모르는 화면 사이에서 "나가기 전에
// 확인이 필요하다"는 상태를 공유하기 위한 모듈 바깥의 작은 스토어다.
export interface NavigationGuard {
  message: string;
  onLeave: () => void;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let currentGuard: NavigationGuard | null = null;

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeNavigationGuard(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNavigationGuardSnapshot() {
  return currentGuard;
}

export function getServerNavigationGuardSnapshot() {
  return null;
}

export function setNavigationGuard(guard: NavigationGuard | null) {
  currentGuard = guard;
  notifyListeners();
}
