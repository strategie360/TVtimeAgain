import { ImportForm } from "@/components/import-form";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Importer depuis Letterboxd" };

export default function ImportPage() {
  return (
    <>
      <PageTitle sub="Tes films vus, tes notes et ta watchlist, en une fois.">Importer depuis Letterboxd</PageTitle>
      <ImportForm />
    </>
  );
}
