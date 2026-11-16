import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { SearchBox } from "@/components/search-box";
import { LogoutButton } from "@/components/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))] md:pb-8">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/" className="text-lg font-black tracking-tight">
          Next<span className="text-accent">Up</span>
        </Link>
        <Suspense>
          <SearchBox />
        </Suspense>
        <LogoutButton />
      </div>
      <div className="mb-4 hidden md:block">
        <Nav />
      </div>
      <main>{children}</main>
      <div className="md:hidden">
        <Nav />
      </div>
    </div>
  );
}
