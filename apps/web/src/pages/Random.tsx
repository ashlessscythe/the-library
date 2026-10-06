import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLibraryEngine } from "@/hooks/useLibraryEngine";
import { bookPathFromIdentifier } from "@/lib/routes";

export function Random() {
  const navigate = useNavigate();
  const { ready, error, random } = useLibraryEngine();
  const [status, setStatus] = useState("Choosing a page…");

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    random()
      .then((id) => {
        if (!cancelled) navigate(bookPathFromIdentifier(id), { replace: true });
      })
      .catch((e: Error) => {
        if (!cancelled) setStatus(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, random, navigate]);

  return (
    <p className="font-mono text-sm text-[var(--muted)]">{error ?? status}</p>
  );
}
