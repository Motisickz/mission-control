import { redirect } from "next/navigation";

import { CommunicationEventView } from "@/features/communication/communication-event-view";

export default async function CommunicationEventPage({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const { id } = await params;
  if (!id || typeof id !== "string") {
    redirect("/communication/events");
  }
  return <CommunicationEventView eventId={id} />;
}
