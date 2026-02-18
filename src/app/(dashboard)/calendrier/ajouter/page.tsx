import { redirect } from "next/navigation";

export default function CalendrierAjouterPage() {
  redirect("/calendrier?section=add");
}
