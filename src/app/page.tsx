import { redirect } from "next/navigation";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";

export default async function Home() {
  if (await isAuthenticatedNextjs()) {
    redirect("/missions");
  }
  redirect("/apercu");
}
