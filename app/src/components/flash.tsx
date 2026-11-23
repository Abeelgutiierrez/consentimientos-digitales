"use client";
import { useEffect, useState } from "react";

// Aviso flotante tras una acción (se oculta solo a los 5 s), como en la demo.
export function Flash({ type = "ok", text }: { type?: "ok" | "bad" | "warn"; text: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div className={`notice ${type} flash`} role="status">
      {text}
    </div>
  );
}
