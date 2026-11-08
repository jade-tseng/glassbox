import { Suspense } from "react";
import { RunView } from "@/components/run/RunView";

// The dense run view (ledger, heatmap, signals, query). /run/<id> tells the run as a story and links here.
export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-frost" />}>
      <Inner params={params} />
    </Suspense>
  );
}

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunView runId={id} />;
}
