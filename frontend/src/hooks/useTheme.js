import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("fpt-theme");
      return ["light", "dark", "system"].includes(saved) ? saved : "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem("fpt-theme", theme);
    } catch {
      /* Theme remains usable without storage. */
    }
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return [theme, setTheme];
}
