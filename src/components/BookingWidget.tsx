import { useEffect } from "react";

const SCRIPT_SRC = "https://elfsightcdn.com/platform.js";
const APP_CLASS = "elfsight-app-bec8d293-c598-47a1-accd-81cbe273a07a";

export function BookingWidget() {
  useEffect(() => {
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    document.body.appendChild(s);
  }, []);

  return (
    <div className="mt-4 overflow-hidden rounded-sm border border-[var(--brass)]/40 bg-background p-2">
      <div className={APP_CLASS} data-elfsight-app-lazy />
    </div>
  );
}