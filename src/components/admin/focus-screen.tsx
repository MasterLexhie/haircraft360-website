"use client";

import { useEffect } from "react";

/**
 * Marks a full-screen task (like adding an expense): on a phone the bottom menu hides while it
 * shows. An effect rather than a CSS :has() check, because pages the owner has left stay mounted
 * (hidden) for a quick Back, and their effects stop when they hide.
 */
export function FocusScreen() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.focusScreen = "";
    return () => {
      delete root.dataset.focusScreen;
    };
  }, []);
  return null;
}
