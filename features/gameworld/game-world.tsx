"use client";

import type { Ref } from "react";
import { useCallback, useEffect, useImperativeHandle, useRef } from "react";

import { GRAVITY_Y, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import type { GameWorldScene } from "./game-world-scene";
import type { GameWorldHandle, MoveCommand } from "./types";

export interface GameWorldProps {
  // 내 캐릭터가 움직일 때마다 호출된다. 전송 주기는 월드 안에서 관리하므로
  // 받는 쪽은 그대로 서버로 보내면 된다.
  onMove?: (command: MoveCommand) => void;
  className?: string;
  ref?: Ref<GameWorldHandle>;
}

function isTypingTarget(element: Element | null) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.isContentEditable
  );
}

export function GameWorld({ onMove, className, ref }: GameWorldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GameWorldScene | null>(null);
  // 엔진 셋업은 청크를 내려받는 동안 비동기로 진행된다. 그 전에 도착한
  // 명령을 흘려보내면 "내 캐릭터가 끝내 안 생기는" 상태가 되므로, 준비될
  // 때까지 쌓아뒀다가 순서대로 재생한다.
  const pendingRef = useRef<Array<(scene: GameWorldScene) => void>>([]);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  const runOnScene = useCallback((task: (scene: GameWorldScene) => void) => {
    const scene = sceneRef.current;
    if (scene) {
      task(scene);
      return;
    }
    pendingRef.current.push(task);
  }, []);

  useEffect(() => {
    let disposed = false;
    let game: Phaser.Game | null = null;

    void (async () => {
      // Phaser는 window에 의존해서 서버에서는 불러올 수 없다. 이 동적
      // import가 SSR 번들에서 빠지게 하는 경계다.
      const [phaserModule, sceneModule] = await Promise.all([
        import("phaser"),
        import("./game-world-scene"),
      ]);
      if (disposed || !hostRef.current) {
        return;
      }

      const Phaser = phaserModule.default;
      const scene = new sceneModule.GameWorldScene({
        onMove: (command) => onMoveRef.current?.(command),
        onReady: () => {
          sceneRef.current = scene;
          const queued = pendingRef.current;
          pendingRef.current = [];
          for (const task of queued) {
            task(scene);
          }
        },
      });

      game = new Phaser.Game({
        type: Phaser.AUTO,
        // 채팅 UI가 위에 겹치는 배경 레이어라서 캔버스는 투명해야 한다.
        transparent: true,
        parent: hostRef.current,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: WORLD_WIDTH,
          height: WORLD_HEIGHT,
        },
        physics: {
          default: "arcade",
          arcade: { gravity: { x: 0, y: GRAVITY_Y } },
        },
        scene,
      });

      // 개발 모드의 StrictMode는 mount → cleanup → 재mount를 한 번
      // 시뮬레이션한다. 그 사이에 청크 로딩이 끝나면 cleanup이 이미
      // 지나간 뒤라 여기서 직접 정리해야 한다.
      if (disposed) {
        game.destroy(true);
        game = null;
      }
    })();

    return () => {
      disposed = true;
      sceneRef.current = null;
      pendingRef.current = [];
      game?.destroy(true);
      game = null;
    };
  }, []);

  // 채팅 입력창에 포커스가 있는 동안 방향키는 커서 이동이어야 한다.
  useEffect(() => {
    function syncInputEnabled() {
      const typing = isTypingTarget(document.activeElement);
      runOnScene((scene) => scene.setInputEnabled(!typing));
    }

    syncInputEnabled();
    document.addEventListener("focusin", syncInputEnabled);
    document.addEventListener("focusout", syncInputEnabled);
    return () => {
      document.removeEventListener("focusin", syncInputEnabled);
      document.removeEventListener("focusout", syncInputEnabled);
    };
  }, [runOnScene]);

  useImperativeHandle(
    ref,
    () => ({
      setMe: (name) => runOnScene((scene) => scene.setMe(name)),
      upsertPlayer: (player) => runOnScene((scene) => scene.upsertPlayer(player)),
      removePlayer: (name) => runOnScene((scene) => scene.removePlayer(name)),
      showSpeech: (name, text) =>
        runOnScene((scene) => scene.showSpeech(name, text)),
    }),
    [runOnScene]
  );

  return <div ref={hostRef} aria-hidden className={className} />;
}
