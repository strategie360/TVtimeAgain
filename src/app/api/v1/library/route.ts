import { requireUser } from "@/lib/auth";
import { route } from "@/lib/api";
import { getLibrary } from "@/lib/queries";

export const GET = route(async () => getLibrary((await requireUser()).id));
