import { Suspense } from "react";
import { RunView } from "@/components/run/RunView";

export default function RunPage({ params }: PageProps<"/run/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-frost" />}>
      <RunPageInner params={params} />
    </Suspense>
  );
}

async function RunPageInner({ params }: { params: PageProps<"/run/[id]">["params"] }) {
  const { id } = await params;
  return <RunView runId={id} />;
}
