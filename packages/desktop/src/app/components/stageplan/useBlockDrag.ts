import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useRef } from "react";
import type {
  StageplanBlock,
  StageplanBlockSlot,
  StageplanStageSize,
} from "../../../../../../src/domain/model/types";
import {
  moveBlockTo,
  resizeBlockTo,
  rotateBlockTo,
} from "../../../../../../src/domain/stageplan/layout/blockOps";
import type { ZoneHandle } from "../../../../../../src/domain/stageplan/layout/blockOps";
import type { StageScale } from "../../../../../../src/domain/stageplan/layout/scale";

type Gesture =
  | { kind: "move"; block: StageplanBlock; startXPx: number; startYPx: number }
  | {
      kind: "rotate";
      block: StageplanBlock;
      centerXPx: number;
      centerYPx: number;
    }
  | {
      kind: "resize";
      block: StageplanBlock;
      handle: ZoneHandle;
      startXPx: number;
      startYPx: number;
    };

type BlockDragArgs = {
  scale: StageScale;
  area: StageplanStageSize;
  snap: boolean;
  onChange: (slot: StageplanBlockSlot, next: StageplanBlock) => void;
  /** Jednou na začátku gesta — odsud si stránka bere snapshot pro undo. */
  onGestureStart: () => void;
  onGestureEnd: () => void;
};

/**
 * Hook drží jen ukazatel gesta a výchozí bod. Snap, clamp i zaokrouhlení dělá
 * doména — tady se pixely jen převedou na metry.
 */
export function useBlockDrag(args: BlockDragArgs) {
  const gestureRef = useRef<Gesture | null>(null);
  /**
   * Gesto žije na window listenerech déle než jeden render, takže si nesmí
   * zapamatovat props z chvíle, kdy začalo — ref je drží aktuální.
   */
  const argsRef = useRef(args);
  argsRef.current = args;

  const bindWindow = useCallback(() => {
    function onPointerMove(event: PointerEvent) {
      const gesture = gestureRef.current;
      if (!gesture) return;
      const current = argsRef.current;

      if (gesture.kind === "move") {
        const deltaXM = current.scale.toM(event.clientX - gesture.startXPx);
        const deltaYM = current.scale.toM(event.clientY - gesture.startYPx);
        current.onChange(
          gesture.block.slot,
          moveBlockTo(
            gesture.block,
            {
              centerXM: gesture.block.centerXM + deltaXM,
              centerYM: gesture.block.centerYM + deltaYM,
            },
            { area: current.area, snap: current.snap },
          ),
        );
        return;
      }

      if (gesture.kind === "resize") {
        current.onChange(
          gesture.block.slot,
          resizeBlockTo(
            gesture.block,
            gesture.handle,
            {
              // Posun od začátku gesta, ne přírůstek — resizeBlockTo počítá
              // rozměr z výchozího bloku, který si gesto drží.
              xM: current.scale.toM(event.clientX - gesture.startXPx),
              yM: current.scale.toM(event.clientY - gesture.startYPx),
            },
            { area: current.area, snap: current.snap },
          ),
        );
        return;
      }

      const radians = Math.atan2(
        event.clientY - gesture.centerYPx,
        event.clientX - gesture.centerXPx,
      );
      const degrees = (radians * 180) / Math.PI + 90;
      current.onChange(
        gesture.block.slot,
        rotateBlockTo(gesture.block, degrees, {
          area: current.area,
          snap: current.snap,
        }),
      );
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      if (!gestureRef.current) return;
      gestureRef.current = null;
      argsRef.current.onGestureEnd();
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }, []);

  const startMove = useCallback(
    (event: ReactPointerEvent, block: StageplanBlock) => {
      event.preventDefault();
      event.stopPropagation();
      gestureRef.current = {
        kind: "move",
        block,
        startXPx: event.clientX,
        startYPx: event.clientY,
      };
      argsRef.current.onGestureStart();
      bindWindow();
    },
    [bindWindow],
  );

  const startRotate = useCallback(
    (event: ReactPointerEvent, block: StageplanBlock) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget
        .closest(".stage-block")
        ?.getBoundingClientRect();
      if (!rect) return;
      gestureRef.current = {
        kind: "rotate",
        block,
        centerXPx: rect.left + rect.width / 2,
        centerYPx: rect.top + rect.height / 2,
      };
      argsRef.current.onGestureStart();
      bindWindow();
    },
    [bindWindow],
  );

  const startResize = useCallback(
    (event: ReactPointerEvent, block: StageplanBlock, handle: ZoneHandle) => {
      // stopPropagation je tu nutnost, ne zdvořilost: úchyt leží uvnitř karty,
      // na které visí tažení, takže bez něj by gesto rozjelo posun (R8).
      event.preventDefault();
      event.stopPropagation();
      gestureRef.current = {
        kind: "resize",
        block,
        handle,
        startXPx: event.clientX,
        startYPx: event.clientY,
      };
      argsRef.current.onGestureStart();
      bindWindow();
    },
    [bindWindow],
  );

  return { startMove, startRotate, startResize };
}
