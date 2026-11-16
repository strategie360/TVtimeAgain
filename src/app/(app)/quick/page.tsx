import Link from "next/link";
import { QuickPick } from "@/components/quick-pick";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Déjà vus" };

export default async function QuickPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const kind = (await searchParams).kind === "tv" ? "tv" : "movie";
  return (
    <>
      <PageTitle sub={<>Ou importe tout ton historique <Link href="/import" className="text-accent underline">depuis Letterboxd</Link>.</>}>
        Ce que tu as déjà vu
      </PageTitle>
      <QuickPick key={kind} kind={kind} />
    </>
  );
}
