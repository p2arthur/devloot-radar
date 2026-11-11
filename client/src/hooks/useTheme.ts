import { useEffect, useState } from "react";
export const THEME_KEY = "devloot-radar:theme:v1";
export function useTheme() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("theme-natural-mystic"),
  );
  const [chosen, setChosen] = useState(() => {
    try {
      return ["light", "dark"].includes(localStorage.getItem(THEME_KEY) ?? "");
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.className = dark
      ? "theme-natural-mystic"
      : "theme-light";
  }, [dark]);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      if (!chosen) setDark(media.matches);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [chosen]);
  return {
    dark,
    toggle: () => {
      setChosen(true);
      setDark(!dark);
      try {
        localStorage.setItem(THEME_KEY, dark ? "light" : "dark");
      } catch {
        /* session preference still works */
      }
    },
  };
}
