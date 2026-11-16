import { getUser, HttpError } from "@/lib/auth";
import { route } from "@/lib/api";

export const GET = route(async () => {
  const u = await getUser();
  if (!u) throw new HttpError(401, "Non connecté");
  return u;
});
