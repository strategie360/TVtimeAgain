"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "À suivre", icon: "M5 3l14 9-14 9V3z" },
  { href: "/discover", label: "Pour toi", icon: "M12 3l2.5 5.5L20 9.5l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-1z" },
  { href: "/calendar", label: "Agenda", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
  { href: "/library", label: "Séries", icon: "M3 5h18v12H3zM8 21h8" },
  { href: "/movies", label: "Films", icon: "M4 4h16v16H4zM4 9h16M9 4v5M15 4v5" },
  { href: "/stats", label: "Stats", icon: "M5 20V10M12 20V4M19 20v-7" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:border-0 md:bg-transparent md:pb-0">
      <ul className="mx-auto flex max-w-3xl justify-around md:justify-start md:gap-1">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 text-[11px] md:flex-row md:gap-2 md:rounded-full md:text-sm ${
                  active ? "text-accent md:bg-surface" : "text-muted hover:text-fg"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 md:h-4 md:w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
                  <path d={it.icon} />
                </svg>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
