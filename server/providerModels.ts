import { questModels as catalog } from "../src/data/models";

export const pollinationsMap: Record<string, string> = {
  ...Object.fromEntries(catalog.map((model) => [model.id, model.id])),
  "z-ai/glm-5.3-flash": "community/morriszdweck/glm-5.3-flash-free",
  "openai/gpt-6-luna": "community/scriptsnsenses-sys/gpt-6-luna:free",
  "mistralai/mistral-large-3": "community/Saauf/mistral-large-4",
};
