"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function SearchBox() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim().length >= 2) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="flex-1"
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher une série ou un film"
        className="w-full rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
        enterKeyHint="search"
      />
    </form>
  );
}
