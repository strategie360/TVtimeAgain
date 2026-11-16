import { requireUser } from "@/lib/auth";
import { route } from "@/lib/api";
import { getStats } from "@/lib/queries";

export const GET = route(async () => getStats((await requireUser()).id));
