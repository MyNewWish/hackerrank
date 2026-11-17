import { useEffect, useState } from "react";

const query = "(prefers-color-scheme: dark)";

/** Whether the OS is in dark mode, updating live when it changes. */
export function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const onChange = () => setDark(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return dark;
}
