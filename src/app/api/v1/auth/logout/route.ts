import { destroySession } from "@/lib/auth";
import { route } from "@/lib/api";

export const POST = route(async () => {
  await destroySession();
});
