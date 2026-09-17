# 채팅 로그에서 React key 중복 경고가 뜬다

개발 모드 콘솔에 `Encountered two children with the same key, entry-2` 경고가
반복된다. `useChatRoomSocket`의 `appendEntry`가 `setEntries` 업데이터 **안에서**
`nextEntryId()`를 호출해, StrictMode가 업데이터를 두 번 실행할 때 같은 메시지가
서로 다른 id로 두 번 쌓이는 것으로 보인다. id 발급을 업데이터 밖으로 빼면 된다.

gameworld 작업 전부터 있던 문제이고 그 작업으로 건드린 코드도 아니라 범위 밖으로 둔다.
