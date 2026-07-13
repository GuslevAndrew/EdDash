"use client";

import { useEffect, useRef } from "react";

export function useAutoCloseDetails() {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;

      if (!details?.open || !(event.target instanceof Node)) {
        return;
      }

      if (!details.contains(event.target)) {
        details.removeAttribute("open");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        detailsRef.current?.removeAttribute("open");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return detailsRef;
}
