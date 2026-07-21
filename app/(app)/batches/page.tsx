import { getBatches } from "@/lib/data";
import { BatchExplorer } from "@/components/batch-explorer";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const batches = await getBatches();
  return <BatchExplorer batches={batches} />;
}
