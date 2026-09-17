# 새로 입장하면 이미 있던 사람의 캐릭터가 안 보인다

`{ready:true}` 뒤에 오는 위치 스냅샷(`realtime_useraction`)에 기존 참여자 것이 빠져
있어, 그 사람이 다시 움직이기 전까지 화면에 캐릭터가 생기지 않는다. 2026-09-17
실제 방에서 확인했고, 그 사람이 방향키를 누른 순간 정상적으로 나타났다.

원인은 서버의 `session.lastAction`이 hibernation 복귀 시 복구되지 않는 것으로 보인다
(`_ai_artifacts/api/api_room_websocket.md` 7-2절). 클라이언트만으로 덮으려면 정지 중에도
저주기로 위치를 한 번씩 흘려보내는 keepalive가 필요하다.
