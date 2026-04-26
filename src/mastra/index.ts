import { Mastra } from "@mastra/core/mastra";

import { astariaAgent } from "../agents/astaria";
import { tanitAgent } from "../agents/tanit";
import { ingestionWorkflow } from "../workflows/ingestion";

export const mastra = new Mastra({
  agents: { tanitAgent, astariaAgent },
  workflows: { ingestionWorkflow },
});
