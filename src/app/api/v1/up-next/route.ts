import { requireUser } from "@/lib/auth";
import { route } from "@/lib/api";
import { getUpNext } from "@/lib/queries";

export const GET = route(async () => getUpNext((await requireUser()).id));
