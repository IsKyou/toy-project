const NICKNAME_STORAGE_KEY = "userprofile:nickname";

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeNickname(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStoredNickname() {
  try {
    return window.localStorage.getItem(NICKNAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

// undefined는 "서버/하이드레이션 시점이라 아직 확정 못 함"을 뜻하고,
// ""(빈 문자열)은 "확정됐고 저장된 닉네임이 없음"을 뜻한다. 이 둘을
// 구분해야 하이드레이션이 끝나기 전에 "닉네임 없음"으로 성급히 판단하는
// 코드(예: 자동 리다이렉트)가 오작동하지 않는다.
export function getServerNicknameSnapshot(): string | undefined {
  return undefined;
}

export function saveNickname(value: string) {
  window.localStorage.setItem(NICKNAME_STORAGE_KEY, value);
  notifyListeners();
}
