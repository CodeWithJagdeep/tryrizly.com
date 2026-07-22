"use client";

import { useParams } from "next/navigation";
import { FlowBuilderClient } from "./flow-builder-client";

export default function AutomationBuilderPage() {
  const params = useParams<{ id: string }>();
  return <FlowBuilderClient flowId={params.id} />;
}
