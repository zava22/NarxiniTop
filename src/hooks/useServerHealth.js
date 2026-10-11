import { useCallback, useEffect, useState } from "react";
import { checkServer } from "../services/admin";

/* Polls /api/health: ok | stale (server older than the panel) | offline | db (MongoDB down) | checking. */
export default function useServerHealth(intervalMs = 30000) {
  const [health, setHealth] = useState({ state: "checking" });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let off = false;
    const run = () => checkServer().then((r) => { if (!off) setHealth(r); });
    run();
    const id = setInterval(run, intervalMs);
    return () => { off = true; clearInterval(id); };
  }, [intervalMs, tick]);

  const recheck = useCallback(() => { setHealth({ state: "checking" }); setTick((n) => n + 1); }, []);
  return { health, recheck };
}
