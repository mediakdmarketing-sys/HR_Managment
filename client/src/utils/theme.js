import { useEffect, useState } from "react";

const STORAGE_KEY = "theme";
const CHANGE_EVENT = "themechange";

// index.html applies the saved theme before React loads, so the class is the source of truth.
export const getTheme = () =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

export const setTheme = (theme) => {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  root.classList.toggle("dark", theme === "dark");
  window.setTimeout(() => root.classList.remove("theme-transition"), 250);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The theme still applies for this visit.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

export const useTheme = () => {
  const [theme, setThemeState] = useState(getTheme);

  useEffect(() => {
    const sync = () => setThemeState(getTheme());
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  return [theme, () => setTheme(theme === "dark" ? "light" : "dark")];
};
