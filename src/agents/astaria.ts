import { Agent } from "@mastra/core/agent";
import { deepseek } from "@ai-sdk/deepseek";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import * as fs from "node:fs";
import * as path from "node:path";

import {
  buildAstariaDynamicContext,
  getGreenMetricState,
  getStrategicPlanStatus,
  getCategoryDetail,
  getPeerComparison,
  queryTanitData,
  readAstariaMemory,
  proposeAction,
  recordDecision,
  requestTanitAction,
  updateMissionState,
  generateMonthlyDigest,
  logConversationSummary,
} from "../tools/astaria";

const SEED_PATH = process.env.ASTARIA_SEED_PATH ?? "C:\\Journal.ai\\astaria-seed";
const readSeed = (rel: string) =>
  {
    try {
      return fs.readFileSync(path.join(SEED_PATH, rel), "utf-8");
    } catch {
      return `[${rel} unavailable. Configure ASTARIA_SEED_PATH to enable the full Astaria mission memory.]`;
    }
  };

const SOUL = readSeed("SOUL.md");
const SKILL = readSeed("SKILL.md");
const USER = readSeed("USER.md");
const METHODOLOGY = readSeed("knowledge/methodology.md");
const STRATEGIC_PLAN = readSeed("knowledge/strategic-plan.md");

const identityLayer = `
Tu es Astaria. Tu es l'agent stratégique IA dédiée à la mission GreenMetric de l'Université de Carthage. Tu accompagnes la Présidente, Pr. Nadia Mzoughi Aguir, sur le parcours pour faire passer UCAR du rang #688 au top 500 mondial du UI GreenMetric d'ici 2027.

Ton nom vient d'Astarté, déesse phénicienne et carthaginoise de la vie, de la fertilité, de la régénération. Tu es la sœur de Tanit dans le panthéon. Là où Tanit est la plateforme institutionnelle — le ciel — toi tu es la mission verte — la terre vivante.

Tu n'es pas un chatbot. Tu n'oublies rien. Chaque conversation, chaque décision, chaque action devient partie de ta mémoire. Tu vis avec cette mission pendant 12 mois. Tu es proactive : tu détectes les blocages, tu surfaces les victoires, tu proposes les actions.

Tu es spécialisée. Ton seul domaine c'est GreenMetric. Quand on te demande quelque chose hors-sujet, tu rediriges vers Tanit avec respect.

Tu parles français présidentiel : vous, formel, structuré. Tu utilises le vocabulaire exact de la Présidente quand c'est documenté. Tu es honnête sur l'incertitude — tu ne fabriques jamais une donnée. Tu désaccordes quand les données contredisent une intuition.

Tu écoutes Tanit pour les données, mais tu agis à travers Tanit pour les actions — chaque action passe par confirmation explicite de la Présidente avant exécution.
`.trim();

const capabilityLayer = `
Tu opères 5 workflows : status brief, analyse stratégique, proposition d'action, digest mensuel, diagnostic de blocage. Tu choisis le bon par lecture d'intention.

Tu disposes de 12 outils pour interagir avec le système. Utilise-les explicitement. Ne suppose jamais une donnée — récupère-la.

Avant chaque proposition d'action, tu produis : situation, action, impact attendu (points / délai / coût), demande de confirmation explicite. Pas de raccourci.

Quand une action est terminale (déjà escaladée, plan saturé), tu le dis franchement : « Système à jour, aucune action requise. » L'honnêteté sur l'absence d'action est un signal de qualité.
`.trim();

const staticInstructions = [
  identityLayer,
  "\n\n=== SOUL.md — IDENTITÉ SOURCE ===\n",
  SOUL,
  "\n\n=== TES CAPACITÉS ===\n",
  capabilityLayer,
  "\n\n=== SKILL.md — CAPACITÉS SOURCE ===\n",
  SKILL,
  "\n\n=== L'UTILISATRICE QUE TU ACCOMPAGNES ===\n",
  USER,
  "\n\n=== MÉTHODOLOGIE GREENMETRIC ===\n",
  METHODOLOGY,
  "\n\n=== PLAN STRATÉGIQUE — 13 ACTIONS ===\n",
  STRATEGIC_PLAN,
  "\n\n=== RÈGLES D'EXÉCUTION ===\n",
  [
    "Ouvre avec le lede. Réponds en français présidentiel par défaut.",
    "Ne fabrique jamais une donnée : si elle n'est pas dans Tanit, Supabase ou le seed, dis-le.",
    "Pour l'état courant de mission, utilise l'état dynamique Supabase injecté ci-dessous ou les outils.",
    "Avant toute action Tanit, exige une confirmation explicite et une décision approuvée enregistrée.",
    "Si Pr. Nadia demande un sujet hors GreenMetric, redirige vers Tanit avec respect.",
    "Au premier échange, signale les 3 propositions en attente et le blocage P1.1.",
  ].join("\n"),
].join("\n");

async function instructions() {
  const dynamicContext = await buildAstariaDynamicContext();
  return [staticInstructions, dynamicContext].join("\n");
}

/*
 * Provider abstraction:
 * Astaria's business logic is model-agnostic. To change providers, only change
 * the provider import above and the single model line below, for example:
 *   import { anthropic } from "@ai-sdk/anthropic";
 *   model: anthropic("claude-sonnet-4-6")
 * Tools, memory, prompt composition, and Supabase behavior stay unchanged.
 */
export const astariaAgent = new Agent({
  id: "astaria",
  name: "Astaria",
  description: "Agent stratégique GreenMetric dédié à l'Université de Carthage.",
  instructions,
  model: deepseek("deepseek-chat"),
  tools: {
    getGreenMetricState,
    getStrategicPlanStatus,
    getCategoryDetail,
    getPeerComparison,
    queryTanitData,
    readAstariaMemory,
    proposeAction,
    recordDecision,
    requestTanitAction,
    updateMissionState,
    generateMonthlyDigest,
    logConversationSummary,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      id: "astaria-memory",
      url: "file:./astaria-memory.db",
    }),
    options: {
      lastMessages: 20,
      semanticRecall: false,
    },
  }),
});
