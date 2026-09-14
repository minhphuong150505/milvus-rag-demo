import { useEffect, useState } from "react";
import { checkHealth } from "../api/chatApi.js";

export function useHealth() {
  const [status, setStatus] = useState("checking");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const check = async () => {
      try {
        await checkHealth(controller.signal);
        if (active) setStatus("online");
      } catch {
        if (active) setStatus("offline");
      }
    };
    check();
    const timer = setInterval(check, 30000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  return status;
}
