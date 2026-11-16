"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api } from "./client-api";

/** Note sur 5 étoiles avec demi-étoiles (stockée de 1 à 10, comme Letterboxd). */
export function Stars({ value, path }: { value: number | null; path: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [hover, setHover] = useState<number | null>(null);
  const [current, setCurrent] = useState(value);
  const shown = hover ?? current ?? 0;

  const save = (v: number | null) =>
    start(async () => {
      setCurrent(v);
      await api(path, "PATCH", { rating: v }).catch(() => setCurrent(value));
      router.refresh();
    });

  return (
    <div className="flex items-center gap-2">
      <div className={`flex ${pending ? "opacity-60" : ""}`} onMouseLeave={() => setHover(null)} role="radiogroup" aria-label="Ma note">
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = shown >= i * 2 ? 1 : shown === i * 2 - 1 ? 0.5 : 0;
          return (
            <span key={i} className="relative h-7 w-7">
              <svg viewBox="0 0 24 24" className="absolute inset-0 h-7 w-7 text-surface-2" fill="currentColor"><path d="M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9z" /></svg>
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <svg viewBox="0 0 24 24" className="h-7 w-7 text-accent" fill="currentColor"><path d="M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9z" /></svg>
              </span>
              {[i * 2 - 1, i * 2].map((v, half) => (
                <button
                  key={v}
                  type="button"
                  aria-label={`${v / 2} étoile${v > 2 ? "s" : ""}`}
                  onMouseEnter={() => setHover(v)}
                  onClick={() => save(current === v ? null : v)}
                  className={`absolute top-0 h-full w-1/2 ${half ? "right-0" : "left-0"}`}
                />
              ))}
            </span>
          );
        })}
      </div>
      <span className="text-sm text-muted">{current ? `${current / 2}/5` : "Pas noté"}</span>
    </div>
  );
}
