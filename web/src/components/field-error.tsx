"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";

/** 每次 pulse 重播一次左右晃动。 */
export function useErrorShake() {
  const [token, setToken] = useState(0);
  const [shake, setShake] = useState(false);

  const pulse = useCallback(() => {
    setToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (token === 0) return;
    setShake(false);
    const id = requestAnimationFrame(() => setShake(true));
    return () => cancelAnimationFrame(id);
  }, [token]);

  return { shake, pulse };
}

export function fieldInvalidClass(invalid: boolean, shake: boolean) {
  if (!invalid) return "";
  return shake ? "field-invalid field-shake" : "field-invalid";
}

export function ErrorSlide({ children }: { children: ReactNode }) {
  return (
    <div className="field-error-pop" role="alert">
      <div>{children}</div>
    </div>
  );
}
