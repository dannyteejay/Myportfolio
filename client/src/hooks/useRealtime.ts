import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "../lib/socket";

// Subscribes to server change events and invalidates the matching queries so
// the public site and admin dashboard stay in sync in real time.
export function useRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const socket = getSocket();
    const map: Record<string, string[]> = {
      "projects:changed": ["projects"],
      "products:changed": ["products"],
      "skills:changed": ["skills"],
      "profile:changed": ["profile"],
      "messages:changed": ["messages"],
      "orders:changed": ["orders"],
      "settings:changed": ["payment-methods", "payment-settings"],
    };
    const handlers: Array<[string, () => void]> = [];
    for (const [event, keys] of Object.entries(map)) {
      const handler = () => {
        keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      };
      socket.on(event, handler);
      handlers.push([event, handler]);
    }
    return () => {
      handlers.forEach(([event, handler]) => socket.off(event, handler));
    };
  }, [qc]);
}