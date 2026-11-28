import { models, questModelIds, questModels } from "../src/data/models";
import { pollinationsMap } from "../server/providerModels";

const endpoint = "https://gen.pollinations.ai/v1/models";

const response = await fetch(endpoint);
if (!response.ok) {
  console.error(`Could not load Pollinations model catalog: HTTP ${response.status}`);
  process.exit(1);
}

const payload = (await response.json()) as {
  data?: Array<{ id: string; paid_only?: boolean }>;
};
const live = new Map((payload.data ?? []).map((m) => [m.id, m]));

const problems: string[] = [];
for (const model of models) {
  if (!questModelIds.has(model.id)) {
    problems.push(`${model.id}: in catalog but not verified for Quest Pollen`);
    continue;
  }
  const providerId = pollinationsMap[model.id];
  const entry = live.get(providerId);
  if (!entry) {
    problems.push(`${model.id} (${providerId}): no longer in the Pollinations catalog`);
  } else if (entry.paid_only !== false) {
    problems.push(`${model.id}: now paid-only — remove from questModelIds`);
  }
}

if (problems.length) {
  console.error(`Quest Pollen model check failed (${endpoint}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`OK: ${questModels.length}/${models.length} catalog models are Quest-Pollen eligible.`);
