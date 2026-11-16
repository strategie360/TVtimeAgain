import { requireUser } from "@/lib/auth";
import { route } from "@/lib/api";
import { getMovies } from "@/lib/queries";

export const GET = route(async () => getMovies((await requireUser()).id));
