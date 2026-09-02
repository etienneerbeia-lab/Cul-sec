"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ShakePermission = "unknown" | "needed" | "granted" | "denied" | "unsupported";

const SHAKE_DELTA_THRESHOLD = 18; // sum of |Δx|+|Δy|+|Δz| in m/s² between two readings
const SHAKE_COOLDOWN_MS = 1200;

interface RequestPermissionMotionEvent {
  requestPermission?: () => Promise<"granted" | "denied">;
}

function needsIOSPermission(): boolean {
  return (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof (DeviceMotionEvent as unknown as RequestPermissionMotionEvent).requestPermission === "function"
  );
}

// Fires onShake once per physical shake while `active`. iOS 13+ requires an
// explicit requestPermission() call from within a user gesture before
// devicemotion events start firing at all — requestPermission() below must
// be invoked directly from a tap handler for that to work.
export function useShakeDetect(onShake: () => void, active: boolean) {
  // Lazy initializer instead of an effect — this only ever needs to run
  // once, synchronously, and it's safe to touch `window`/DeviceMotionEvent
  // here since this hook is only ever called from "use client" components
  // that mount post-hydration.
  const [permission, setPermission] = useState<ShakePermission>(() => {
    if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") return "unsupported";
    return needsIOSPermission() ? "needed" : "granted";
  });
  const lastShakeAt = useRef(0);
  const lastAccel = useRef<{ x: number; y: number; z: number } | null>(null);
  const onShakeRef = useRef(onShake);
  useEffect(() => {
    onShakeRef.current = onShake;
  });

  const requestPermission = useCallback(async () => {
    if (!needsIOSPermission()) {
      setPermission("granted");
      return;
    }
    try {
      const result = await (
        DeviceMotionEvent as unknown as Required<RequestPermissionMotionEvent>
      ).requestPermission();
      setPermission(result === "granted" ? "granted" : "denied");
    } catch {
      setPermission("denied");
    }
  }, []);

  useEffect(() => {
    if (!active || permission !== "granted") return;

    function handleMotion(e: DeviceMotionEvent) {
      const acc = e.accelerationIncludingGravity;
      if (!acc || acc.x == null || acc.y == null || acc.z == null) return;
      const prev = lastAccel.current;
      lastAccel.current = { x: acc.x, y: acc.y, z: acc.z };
      if (!prev) return;
      const delta = Math.abs(acc.x - prev.x) + Math.abs(acc.y - prev.y) + Math.abs(acc.z - prev.z);
      const now = Date.now();
      if (delta > SHAKE_DELTA_THRESHOLD && now - lastShakeAt.current > SHAKE_COOLDOWN_MS) {
        lastShakeAt.current = now;
        onShakeRef.current();
      }
    }

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [active, permission]);

  return { permission, requestPermission };
}
