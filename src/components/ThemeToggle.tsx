"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  const toggle = () => setTheme(isDark ? "light" : "dark");

  return (
    <button
      onClick={toggle}
      className="p-1.5 rounded-md transition-all duration-200"
      style={{
        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(249,115,22,0.15)',
        color: isDark ? '#f4f4f5' : '#C94F00',
        border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(201,79,0,0.4)',
      }}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      <span className="sr-only">{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
