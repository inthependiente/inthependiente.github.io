import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, getStoredTheme, resolveInitialTheme, type Theme } from "../theme";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);
  // Persist only explicit user choices, so the OS preference keeps applying until then.
  const userChose = useRef(false);

  useEffect(() => {
    applyTheme(theme, userChose.current);
  }, [theme]);

  const chooseTheme = (next: Theme) => {
    userChose.current = true;
    setTheme(next);
  };

  // Follow OS changes only while the user has not chosen explicitly.
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const onChange = (e: MediaQueryListEvent) => {
      if (!getStoredTheme()) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => chooseTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={isDark ? "Tema claro" : "Tema oscuro"}
      className={`btn btn-sm btn-secondary ${className}`}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      <span className="hidden lg:inline text-[11px] font-medium tracking-wider">
        {isDark ? "Claro" : "Oscuro"}
      </span>
    </button>
  );
}
