import { useCallback, useEffect, useRef, useState } from "react";

const LONG_PRESS_MS = 450;
const DRAG_SLOP = 6;

/**
 * Press-and-hold to start editing, and drag to reorder while editing. Works
 * with touch and mouse. Tiles carry data-home-key so the tile under the
 * pointer can be found while dragging.
 */
export function useTileGestures({ editing, onEnterEdit, onMove, canSwap = () => true }) {
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const [draggingKey, setDraggingKey] = useState(null);

  const clearTimer = () => {
    if (gesture.current?.timer) clearTimeout(gesture.current.timer);
  };
  useEffect(() => clearTimer, []);

  const onPointerDown = useCallback(
    (event, key) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest?.("[data-tile-action]")) return;
      clearTimer();
      const state = { key, x: event.clientX, y: event.clientY, timer: null, dragging: false };
      if (!editing && onEnterEdit) {
        state.timer = setTimeout(() => {
          state.timer = null;
          suppressClick.current = true;
          navigator.vibrate?.(12);
          onEnterEdit();
        }, LONG_PRESS_MS);
      }
      gesture.current = state;
    },
    [editing, onEnterEdit]
  );

  const onPointerMove = useCallback(
    event => {
      const state = gesture.current;
      if (!state) return;
      const moved = Math.hypot(event.clientX - state.x, event.clientY - state.y);
      if (state.timer && moved > DRAG_SLOP * 1.5) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      if (!editing) return;
      if (!state.dragging) {
        if (moved < DRAG_SLOP) return;
        state.dragging = true;
        setDraggingKey(state.key);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // The pointer may already be gone.
        }
      }
      const target = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-home-key]")
        ?.getAttribute("data-home-key");
      if (target && target !== state.key && canSwap(state.key, target)) onMove(state.key, target);
    },
    [editing, onMove, canSwap]
  );

  const end = useCallback(() => {
    const state = gesture.current;
    if (!state) return;
    clearTimer();
    if (state.dragging) suppressClick.current = true;
    gesture.current = null;
    setDraggingKey(null);
  }, []);

  const onClickCapture = useCallback(
    event => {
      // Buttons on a tile (like remove) always work.
      if (event.target.closest?.("[data-tile-action]")) {
        suppressClick.current = false;
        return;
      }
      if (editing || suppressClick.current) {
        event.preventDefault();
        event.stopPropagation();
      }
      suppressClick.current = false;
    },
    [editing]
  );

  const tileProps = key => ({
    "data-home-key": key,
    onPointerDown: event => onPointerDown(event, key),
    onPointerMove,
    onPointerUp: end,
    onPointerCancel: end,
    onContextMenu: event => {
      if (event.nativeEvent.pointerType !== "mouse") event.preventDefault();
    },
    onClickCapture,
  });

  return { tileProps, draggingKey };
}
