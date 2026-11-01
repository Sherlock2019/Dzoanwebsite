"use client";

import { useEffect } from "react";

/**
 * Owner shortcut: Left Shift + A opens /admin (the sign-in page, or the dashboard when already
 * signed in). Ignored while typing in a form field, so capital letters still work there.
 * This is only a shortcut — access is still enforced on the server.
 */
export default function AdminHotkey() {
  useEffect(() => {
    let leftShiftDown = false;

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "ShiftLeft") {
        leftShiftDown = true;
        return;
      }
      if (e.code !== "KeyA" || !e.shiftKey || !leftShiftDown || e.ctrlKey || e.altKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      e.preventDefault();
      window.location.href = "/admin";
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "ShiftLeft") leftShiftDown = false;
    }

    const reset = () => (leftShiftDown = false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", reset);
    };
  }, []);
  return null;
}
