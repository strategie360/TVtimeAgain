import { pageUser } from "@/lib/auth";
import { LogoutButton } from "@/components/actions";
import { DeleteAccount } from "@/components/account-actions";
import { SiteFooter } from "@/components/public-shell";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const user = await pageUser();
  return (
    <>
      <PageTitle sub={user.email}>{user.displayName}</PageTitle>

      <section className="mb-6 rounded-xl bg-surface p-4">
        <h2 className="mb-1 font-semibold">Mes données</h2>
        <p className="mb-3 text-sm text-muted">Un fichier JSON avec ton compte, tes séries et épisodes vus, tes films et tes notes.</p>
        <a href="/api/v1/me/export" download className="inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
          Télécharger mes données
        </a>
      </section>

      <section className="mb-6 rounded-xl bg-surface p-4">
        <h2 className="mb-3 font-semibold">Session</h2>
        <LogoutButton />
      </section>

      <section className="rounded-xl bg-surface p-4">
        <h2 className="mb-3 font-semibold">Zone dangereuse</h2>
        <DeleteAccount />
      </section>

      <SiteFooter />
    </>
  );
}
