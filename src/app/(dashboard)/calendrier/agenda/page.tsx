import { redirect } from "next/navigation";

export default function CalendrierAgendaPage() {
  redirect("/calendrier?section=agenda");
}
