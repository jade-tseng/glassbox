import { Suspense } from "react";
import { RunStory } from "@/components/belief/RunStory";

// A run told as a story (main hypothesis → Before → Beliefs → ask). The dense view lives at /run/<id>/detail.
export default function RunPage({ params }: PageProps<"/run/[id]">) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-frost" />}>
      <RunPageInner params={params} />
    </Suspense>
  );
}

async function RunPageInner({ params }: { params: PageProps<"/run/[id]">["params"] }) {
  const { id } = await params;
  return <RunStory runId={id} />;
}
