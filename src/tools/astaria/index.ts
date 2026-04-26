import { createTool } from "@mastra/core/tools";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabaseUrl =
  process.env.SUPABASE_URL?.startsWith("http")
    ? process.env.SUPABASE_URL
    : process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith("http")
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : "http://localhost:54321";

const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "FILL_THIS",
);

const categoryCodeSchema = z.enum(["SI", "EC", "WS", "WR", "TR", "ED"]);
type CategoryCode = z.infer<typeof categoryCodeSchema>;

type StrategicAction = {
  actionId: string;
  phase: number;
  title: string;
  category: string;
  impactPts: number;
  cost: string;
  costTnd: number | null;
  timeline: string;
  dependencies: string[];
};

const categoryDefinitions: Record<
  CategoryCode,
  {
    label: string;
    metric: string;
    max: number;
    description: string;
  }
> = {
  SI: {
    label: "Setting and Infrastructure",
    metric: "greenmetric_si_score",
    max: 1500,
    description: "Espaces, infrastructures, surfaces vertes, accessibilité",
  },
  EC: {
    label: "Energy and Climate Change",
    metric: "greenmetric_ec_score",
    max: 2100,
    description: "Énergie, climat, bâtiments, émissions",
  },
  WS: {
    label: "Waste",
    metric: "greenmetric_ws_score",
    max: 1800,
    description: "Déchets, recyclage, traitement, eaux usées",
  },
  WR: {
    label: "Water",
    metric: "greenmetric_wr_score",
    max: 1000,
    description: "Conservation, recyclage, appareils économes, pollution",
  },
  TR: {
    label: "Transportation",
    metric: "greenmetric_tr_score",
    max: 1800,
    description: "Mobilité durable, véhicules, parking, cheminements",
  },
  ED: {
    label: "Education and Research",
    metric: "greenmetric_ed_score",
    max: 1800,
    description: "Cours, recherche, événements, coordination durabilité",
  },
};

const categoryIndicators: Record<
  CategoryCode,
  Array<{ code: string; indicator: string; maxPts: number }>
> = {
  SI: [
    { code: "SI.1", indicator: "Open space ratio", maxPts: 200 },
    { code: "SI.2", indicator: "Forest vegetation area", maxPts: 100 },
    { code: "SI.3", indicator: "Planted vegetation area", maxPts: 200 },
    { code: "SI.4", indicator: "Water absorption area", maxPts: 100 },
    { code: "SI.5", indicator: "Open space per person", maxPts: 200 },
    { code: "SI.6", indicator: "Budget for sustainability", maxPts: 100 },
    {
      code: "SI.7",
      indicator: "Disabled, special needs, maternity facilities",
      maxPts: 100,
    },
    { code: "SI.8", indicator: "Security and safety facilities", maxPts: 100 },
    { code: "SI.9", indicator: "Health infrastructure", maxPts: 100 },
    { code: "SI.10", indicator: "Conservation programs", maxPts: 100 },
    { code: "SI.11", indicator: "ICT for SI programs", maxPts: 100 },
  ],
  EC: [
    { code: "EC.1", indicator: "Energy efficient appliances", maxPts: 200 },
    { code: "EC.2", indicator: "Smart building implementation", maxPts: 300 },
    { code: "EC.3", indicator: "Renewable energy sources count", maxPts: 300 },
    { code: "EC.4", indicator: "Electricity per person", maxPts: 200 },
    { code: "EC.5", indicator: "Renewable energy ratio", maxPts: 200 },
    { code: "EC.6", indicator: "Green building elements", maxPts: 200 },
    { code: "EC.7", indicator: "GHG reduction program", maxPts: 200 },
    { code: "EC.8", indicator: "Carbon footprint per person", maxPts: 200 },
    {
      code: "EC.9",
      indicator: "Innovative energy and climate programs",
      maxPts: 100,
    },
    {
      code: "EC.10",
      indicator: "Impactful climate programs",
      maxPts: 100,
    },
    { code: "EC.11", indicator: "ICT for EC programs", maxPts: 100 },
  ],
  WS: [
    { code: "WS.1", indicator: "3R program", maxPts: 200 },
    { code: "WS.2", indicator: "Paper and plastic reduction", maxPts: 300 },
    { code: "WS.3", indicator: "Organic waste treatment", maxPts: 300 },
    { code: "WS.4", indicator: "Inorganic waste treatment", maxPts: 300 },
    { code: "WS.5", indicator: "Toxic waste treatment", maxPts: 300 },
    { code: "WS.6", indicator: "Sewage treatment", maxPts: 300 },
    { code: "WS.7", indicator: "ICT for WS programs", maxPts: 100 },
  ],
  WR: [
    { code: "WR.1", indicator: "Water conservation program", maxPts: 150 },
    { code: "WR.2", indicator: "Water recycling program", maxPts: 200 },
    { code: "WR.3", indicator: "Water efficient appliances", maxPts: 200 },
    { code: "WR.4", indicator: "Treated water consumption", maxPts: 200 },
    { code: "WR.5", indicator: "Water pollution control", maxPts: 200 },
    { code: "WR.6", indicator: "ICT for WR programs", maxPts: 50 },
  ],
  TR: [
    { code: "TR.1", indicator: "Vehicles per campus population", maxPts: 200 },
    { code: "TR.2", indicator: "Shuttle services", maxPts: 250 },
    { code: "TR.3", indicator: "ZEV availability", maxPts: 200 },
    { code: "TR.4", indicator: "ZEV per campus population", maxPts: 200 },
    { code: "TR.5", indicator: "Parking area ratio", maxPts: 200 },
    { code: "TR.6", indicator: "Parking reduction program", maxPts: 200 },
    { code: "TR.7", indicator: "Private vehicle reduction initiatives", maxPts: 200 },
    { code: "TR.8", indicator: "Pedestrian paths", maxPts: 250 },
    { code: "TR.9", indicator: "ICT for TR programs", maxPts: 100 },
  ],
  ED: [
    { code: "ED.1", indicator: "Sustainability courses ratio", maxPts: 200 },
    {
      code: "ED.2",
      indicator: "Sustainability research funding ratio",
      maxPts: 200,
    },
    {
      code: "ED.3",
      indicator: "Sustainability publications per lecturer",
      maxPts: 200,
    },
    { code: "ED.4", indicator: "Sustainability events per year", maxPts: 150 },
    { code: "ED.5", indicator: "Student sustainability activities", maxPts: 150 },
    { code: "ED.6", indicator: "Sustainability website", maxPts: 200 },
    { code: "ED.7", indicator: "Sustainability report", maxPts: 100 },
    { code: "ED.8", indicator: "Cultural activities", maxPts: 100 },
    {
      code: "ED.9",
      indicator: "International sustainability collaborations",
      maxPts: 100,
    },
    {
      code: "ED.10",
      indicator: "Community sustainability services",
      maxPts: 100,
    },
    { code: "ED.11", indicator: "Sustainability-related startups", maxPts: 100 },
    { code: "ED.12", indicator: "Graduates with green jobs", maxPts: 50 },
    {
      code: "ED.13",
      indicator: "Sustainability coordination unit",
      maxPts: 50,
    },
    { code: "ED.14", indicator: "ICT for university governance", maxPts: 100 },
  ],
};

const strategicActions: StrategicAction[] = [
  {
    actionId: "P1.1",
    phase: 1,
    title:
      "Interdiction du plastique à usage unique sur l'ensemble des 33 établissements",
    category: "WS.2",
    impactPts: 200,
    cost: "0 TND",
    costTnd: 0,
    timeline: "1 semaine",
    dependencies: [],
  },
  {
    actionId: "P1.2",
    phase: 1,
    title:
      "Bacs de tri colorés avec signalétique standardisée dans les 33 établissements",
    category: "WS.1 + WS.4",
    impactPts: 150,
    cost: "100K TND",
    costTnd: 100000,
    timeline: "1 mois",
    dependencies: ["P1.1"],
  },
  {
    actionId: "P1.3",
    phase: 1,
    title:
      "Programme trimestriel de tests de qualité de l'eau par les laboratoires FSB",
    category: "WR.5",
    impactPts: 150,
    cost: "15K TND/an",
    costTnd: 15000,
    timeline: "Immédiat",
    dependencies: [],
  },
  {
    actionId: "P1.4",
    phase: 1,
    title:
      "Formalisation de la cellule de coordination développement durable à la Présidence UCAR",
    category: "ED.13",
    impactPts: 30,
    cost: "0 TND",
    costTnd: 0,
    timeline: "1 mois",
    dependencies: [],
  },
  {
    actionId: "P1.5",
    phase: 1,
    title: "Cartographie standardisée des 33 campus",
    category: "SI.1, SI.2, SI.3, SI.5",
    impactPts: 100,
    cost: "30K TND",
    costTnd: 30000,
    timeline: "2 mois",
    dependencies: [],
  },
  {
    actionId: "P2.1",
    phase: 2,
    title: "Robinetterie économe sur 15 établissements pilotes",
    category: "WR.3",
    impactPts: 100,
    cost: "75K TND",
    costTnd: 75000,
    timeline: "4 mois",
    dependencies: [],
  },
  {
    actionId: "P2.2",
    phase: 2,
    title: "Système de récupération d'eau de pluie sur 10 établissements",
    category: "WR.2",
    impactPts: 100,
    cost: "100K TND",
    costTnd: 100000,
    timeline: "6 mois",
    dependencies: [],
  },
  {
    actionId: "P2.3",
    phase: 2,
    title: "Compostage des déchets de cafétéria sur les 10 plus grands établissements",
    category: "WS.3",
    impactPts: 200,
    cost: "50K TND",
    costTnd: 50000,
    timeline: "5 mois",
    dependencies: [],
  },
  {
    actionId: "P2.4",
    phase: 2,
    title: "Trous d'infiltration biopore sur tous les sites",
    category: "WR.1 + SI.4",
    impactPts: 50,
    cost: "5K TND",
    costTnd: 5000,
    timeline: "2 mois",
    dependencies: [],
  },
  {
    actionId: "P2.5",
    phase: 2,
    title: "Contrat UCAR de collecte et traitement certifié des e-déchets",
    category: "WS.5",
    impactPts: 200,
    cost: "10K TND/an",
    costTnd: 10000,
    timeline: "3 mois",
    dependencies: [],
  },
  {
    actionId: "P3.1",
    phase: 3,
    title: "Compteurs intelligents d'énergie sur 10 établissements",
    category: "EC.4 + EC.11",
    impactPts: 100,
    cost: "100K TND",
    costTnd: 100000,
    timeline: "4 mois",
    dependencies: ["P2"],
  },
  {
    actionId: "P3.2",
    phase: 3,
    title: "Audit complet des déchets sur les 33 établissements",
    category: "Base WS",
    impactPts: 100,
    cost: "20K TND",
    costTnd: 20000,
    timeline: "3 mois",
    dependencies: ["P2"],
  },
  {
    actionId: "P3.3",
    phase: 3,
    title: "Formation des 33 référents GreenMetric par établissement",
    category: "Qualité dossier",
    impactPts: 40,
    cost: "5K TND",
    costTnd: 5000,
    timeline: "2 mois",
    dependencies: [],
  },
];

const actionById = new Map(
  strategicActions.map((action) => [action.actionId, action]),
);

const allowedTanitTables = [
  "institutions",
  "kpis",
  "alerts",
  "audit_log",
  "submissions",
] as const;

function getTanitApiUrl() {
  return (
    process.env.TANIT_API_URL ||
    process.env.TANIT_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function statusFor(percentage: number) {
  if (percentage > 75) return "strong";
  if (percentage >= 50) return "medium";
  return "weak";
}

function normalizeSearch(value: unknown) {
  return JSON.stringify(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

async function getUcarInstitutionId() {
  const { data, error } = await supabase
    .from("institutions")
    .select("id")
    .eq("code", "400")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error("Institution UCAR Présidence introuvable (code 400).");
  }

  return data.id as string;
}

async function getGreenMetricKpis(period?: string) {
  const institutionId = await getUcarInstitutionId();
  let query = supabase
    .from("kpis")
    .select("metric, value, period, domain, source")
    .eq("institution_id", institutionId)
    .like("metric", "greenmetric_%")
    .order("period", { ascending: false });

  if (period) {
    query = query.eq("period", period);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data ?? [];
}

function greenMetricSummaryFromRows(rows: Array<Record<string, unknown>>) {
  const metricValues = new Map<string, number>();
  for (const row of rows) {
    const metric = String(row.metric ?? "");
    if (!metricValues.has(metric)) {
      metricValues.set(metric, Number(row.value ?? 0));
    }
  }

  const categories = Object.entries(categoryDefinitions).map(([code, def]) => {
    const score = metricValues.get(def.metric) ?? 0;
    const percentage = roundOne((score / def.max) * 100);

    return {
      code,
      label: def.label,
      description: def.description,
      score,
      max: def.max,
      percentage,
      status: statusFor(percentage),
    };
  });

  const totalScore = metricValues.get("greenmetric_total_score") ?? 0;

  return {
    worldRank: metricValues.get("greenmetric_world_rank") ?? 688,
    nationalRank: metricValues.get("greenmetric_natl_rank") ?? 1,
    totalScore,
    maxScore: 10000,
    percentage: roundOne((totalScore / 10000) * 100),
    top500Threshold: 7200,
    top500Gap: Math.max(0, 7200 - totalScore),
    year: 2025,
    categories,
    weakCategories: categories
      .filter((category) => category.status === "weak")
      .map((category) => category.code),
    source: "uigreenmetric.com 2025 + Tanit Supabase kpis",
  };
}

async function readMissionStateRows() {
  const { data, error } = await supabase
    .from("astaria_mission_state")
    .select("*")
    .order("action_id", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function callTanitApi(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${getTanitApiUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : {
        body: await response.text().catch(() => ""),
        contentType,
        contentDisposition: response.headers.get("content-disposition"),
      };

  if (!response.ok) {
    throw new Error(
      `Tanit API ${path} failed (${response.status}): ${JSON.stringify(
        payload,
      )}`,
    );
  }

  return {
    status: response.status,
    ok: response.ok,
    payload,
  };
}

export async function buildAstariaDynamicContext() {
  try {
    const [missionState, proposalsResult, decisionsResult, conversationsResult] =
      await Promise.all([
        readMissionStateRows(),
        supabase
          .from("astaria_proposals")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
        supabase
          .from("astaria_decisions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("astaria_conversations")
          .select("created_at, summary, register, outcomes")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    if (proposalsResult.error) throw proposalsResult.error;
    if (decisionsResult.error) throw decisionsResult.error;
    if (conversationsResult.error) throw conversationsResult.error;

    const actionLines = missionState.map((row) => {
      const action = actionById.get(String(row.action_id));
      return `- ${row.action_id} (${action?.title ?? "action non cataloguée"}) : ${row.status}, progression ${row.current_progress_pct ?? 0}%, points capturés ${row.captured_points ?? 0}/${row.expected_points ?? action?.impactPts ?? "?"}. Notes: ${row.notes ?? "aucune"}`;
    });

    const proposalLines = (proposalsResult.data ?? []).map(
      (proposal) =>
        `- ${proposal.action_id} : ${proposal.proposed_action ?? proposal.situation ?? "proposition"} | impact ${proposal.expected_impact_pts ?? "?"} pts | coût ${proposal.estimated_cost_tnd ?? "?"} TND | depuis ${proposal.created_at}`,
    );

    const decisionLines = (decisionsResult.data ?? []).map(
      (decision) =>
        `- ${decision.created_at} : ${decision.action_id ?? "sans action"} ${decision.decision}. Raison: ${decision.rationale ?? "non renseignée"}`,
    );

    const conversationLines = (conversationsResult.data ?? []).map(
      (conversation) =>
        `- ${conversation.created_at} (${conversation.register ?? "registre non renseigné"}) : ${conversation.summary}`,
    );

    return [
      "\n\n=== ÉTAT DYNAMIQUE DE LA MISSION (Supabase) ===",
      "Plan stratégique actuel :",
      actionLines.join("\n") || "- Aucun état mission en base.",
      "\nPropositions en attente :",
      proposalLines.join("\n") || "- Aucune proposition en attente.",
      "\nDernières décisions :",
      decisionLines.join("\n") || "- Aucune décision en mémoire.",
      "\nMémoire récente :",
      conversationLines.join("\n") || "- Aucune conversation résumée.",
    ].join("\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `\n\n=== ÉTAT DYNAMIQUE DE LA MISSION ===\nImpossible de charger l'état dynamique depuis Supabase: ${message}\nDans ce cas, Astaria doit utiliser ses outils avant d'annoncer un état chiffré.`;
  }
}

export const getGreenMetricState = createTool({
  id: "get_greenmetric_state",
  description:
    "Retourne l'état GreenMetric UCAR: rang, score total, catégories, faiblesses, écart top 500.",
  inputSchema: z.object({
    period: z.string().optional().describe("Période KPI, par défaut 2025."),
  }),
  execute: async (input) => {
    const rows = await getGreenMetricKpis(input.period ?? "2025");
    return greenMetricSummaryFromRows(rows);
  },
});

export const getStrategicPlanStatus = createTool({
  id: "get_strategic_plan_status",
  description:
    "Retourne les 13 actions du plan GreenMetric avec état opérationnel Supabase, impact, coût et délai.",
  inputSchema: z.object({}),
  execute: async () => {
    const stateRows = await readMissionStateRows();
    const stateByAction = new Map(
      stateRows.map((row) => [String(row.action_id), row]),
    );

    return strategicActions.map((action) => {
      const state = stateByAction.get(action.actionId);
      return {
        ...action,
        status: state?.status ?? "pending",
        startedAt: state?.started_at ?? null,
        completedAt: state?.completed_at ?? null,
        notes: state?.notes ?? null,
        progressPct: state?.current_progress_pct ?? 0,
        expectedPoints: state?.expected_points ?? action.impactPts,
        capturedPoints: state?.captured_points ?? 0,
        updatedAt: state?.updated_at ?? null,
      };
    });
  },
});

export const getCategoryDetail = createTool({
  id: "get_category_detail",
  description:
    "Retourne le détail d'une catégorie UI GreenMetric (SI/EC/WS/WR/TR/ED), ses indicateurs, score UCAR et actions liées.",
  inputSchema: z.object({
    category: categoryCodeSchema,
    period: z.string().optional().describe("Période KPI, par défaut 2025."),
  }),
  execute: async (input) => {
    const rows = await getGreenMetricKpis(input.period ?? "2025");
    const summary = greenMetricSummaryFromRows(rows);
    const category = summary.categories.find(
      (item) => item.code === input.category,
    );
    const actions = strategicActions.filter((action) =>
      action.category.includes(input.category),
    );

    return {
      category,
      indicators: categoryIndicators[input.category],
      relatedActions: actions,
      benchmarks:
        input.category === "WR"
          ? [
              "Top universities treat and reuse wastewater in campus WTPs.",
              "Rainwater harvesting with cisterns is a recurring top-100 benchmark.",
              "Quarterly water quality monitoring improves WR.5 evidence quality.",
            ]
          : input.category === "WS"
            ? [
                "Waste banks, anaerobic digesters, certified e-waste disposal and plastic bans are high-leverage benchmarks.",
              ]
            : [],
      source: "astaria-seed/knowledge/methodology.md + Tanit Supabase kpis",
    };
  },
});

export const getPeerComparison = createTool({
  id: "get_peer_comparison",
  description:
    "Retourne les benchmarks statiques UCAR, Tunisie et top-100 mentionnés dans le seed Astaria.",
  inputSchema: z.object({}),
  execute: async () => ({
    tunisia: [
      {
        university: "Université de Carthage",
        nationalRank: 1,
        worldRank: 688,
        score: 6260,
        note: "Référence UCAR 2025.",
      },
      {
        university: "Université de Sousse",
        nationalRank: 2,
        worldRank: null,
        score: 5567.5,
        note: "Score explicitement présent dans SOUL.md.",
      },
      {
        university: "Université de Manouba",
        nationalRank: null,
        worldRank: null,
        score: null,
        note: "Nom mentionné dans le seed; score non présent dans le vault.",
      },
      {
        university: "Université de Sfax",
        nationalRank: null,
        worldRank: null,
        score: null,
        note: "Nom mentionné dans le seed; score non présent dans le vault.",
      },
      {
        university: "Université de Monastir",
        nationalRank: null,
        worldRank: null,
        score: null,
        note: "Nom mentionné dans le seed; score non présent dans le vault.",
      },
      {
        university: "Université de Tunis",
        nationalRank: null,
        worldRank: null,
        score: null,
        note: "Nom mentionné dans le seed; score non présent dans le vault.",
      },
      {
        university: "Université de Jendouba",
        nationalRank: null,
        worldRank: null,
        score: null,
        note: "Nom mentionné dans le seed; score non présent dans le vault.",
      },
    ],
    internationalBenchmarks: [
      {
        university: "Universitas Indonesia",
        benchmark:
          "Water treatment plants, wastewater reuse, GreenMetric methodology owner.",
      },
      {
        university: "Wageningen University & Research",
        benchmark: "Top-100 sustainability benchmark for campus operations.",
      },
      {
        university: "University of Nottingham",
        benchmark:
          "Water-efficient fixtures and anaerobic digester benchmark cited in the seed.",
      },
      {
        university: "Telkom University",
        benchmark:
          "Water treatment and reuse benchmark cited for WR category maturity.",
      },
    ],
    source:
      "astaria-seed/SOUL.md and astaria-seed/knowledge/methodology.md. Unknown scores are intentionally null.",
  }),
});

export const queryTanitData = createTool({
  id: "query_tanit_data",
  description:
    "Lecture générique et bornée des tables Tanit autorisées: institutions, kpis, alerts, audit_log, submissions.",
  inputSchema: z.object({
    table: z.enum(allowedTanitTables),
    select: z.string().optional().default("*"),
    filters: z
      .array(
        z.object({
          column: z.string(),
          operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "in"]),
          value: z.union([
            z.string(),
            z.number(),
            z.boolean(),
            z.null(),
            z.array(z.union([z.string(), z.number(), z.boolean()])),
          ]),
        }),
      )
      .optional()
      .default([]),
    limit: z.number().int().min(1).max(100).optional().default(50),
    orderBy: z
      .object({ column: z.string(), ascending: z.boolean().optional() })
      .optional(),
  }),
  execute: async (input) => {
    let query = supabase.from(input.table).select(input.select);
    const filters = input.filters ?? [];
    const limit = input.limit ?? 50;

    for (const filter of filters) {
      switch (filter.operator) {
        case "eq":
          query = query.eq(filter.column, filter.value);
          break;
        case "neq":
          query = query.neq(filter.column, filter.value);
          break;
        case "gt":
          query = query.gt(filter.column, filter.value);
          break;
        case "gte":
          query = query.gte(filter.column, filter.value);
          break;
        case "lt":
          query = query.lt(filter.column, filter.value);
          break;
        case "lte":
          query = query.lte(filter.column, filter.value);
          break;
        case "like":
          query = query.like(filter.column, String(filter.value));
          break;
        case "ilike":
          query = query.ilike(filter.column, String(filter.value));
          break;
        case "in":
          if (!Array.isArray(filter.value)) {
            throw new Error("L'opérateur in exige une valeur tableau.");
          }
          query = query.in(filter.column, filter.value);
          break;
      }
    }

    if (input.orderBy) {
      query = query.order(input.orderBy.column, {
        ascending: input.orderBy.ascending ?? true,
      });
    }

    const { data, error } = await query.limit(limit);
    if (error) {
      throw error;
    }

    return {
      table: input.table,
      count: data?.length ?? 0,
      rows: data ?? [],
    };
  },
});

export const readAstariaMemory = createTool({
  id: "read_astaria_memory",
  description:
    "Recherche dans les décisions, propositions et résumés de conversation d'Astaria.",
  inputSchema: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(20).optional().default(10),
  }),
  execute: async (input) => {
    const [decisions, proposals, conversations] = await Promise.all([
      supabase
        .from("astaria_decisions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("astaria_proposals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("astaria_conversations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (decisions.error) throw decisions.error;
    if (proposals.error) throw proposals.error;
    if (conversations.error) throw conversations.error;

    const needle = normalizeSearch(input.query);
    const rows = [
      ...(decisions.data ?? []).map((row) => ({ type: "decision", row })),
      ...(proposals.data ?? []).map((row) => ({ type: "proposal", row })),
      ...(conversations.data ?? []).map((row) => ({
        type: "conversation",
        row,
      })),
    ];

    return rows
      .filter((entry) => normalizeSearch(entry.row).includes(needle))
      .sort((a, b) =>
        String(b.row.created_at ?? "").localeCompare(
          String(a.row.created_at ?? ""),
        ),
      )
      .slice(0, input.limit);
  },
});

export const proposeAction = createTool({
  id: "propose_action",
  description:
    "Insère une proposition d'action Astaria en attente de décision présidentielle.",
  inputSchema: z.object({
    action_id: z.string().min(1),
    situation: z.string().optional(),
    proposed_action: z.string().min(1),
    expected_impact_pts: z.number().int().optional(),
    estimated_cost_tnd: z.number().int().optional(),
    estimated_timeline: z.string().optional(),
    risks: z
      .union([z.array(z.string()), z.record(z.string(), z.unknown())])
      .optional(),
    recommendation: z.string().optional(),
  }),
  execute: async (input) => {
    const { data, error } = await supabase
      .from("astaria_proposals")
      .insert({
        action_id: input.action_id,
        status: "pending",
        situation: input.situation ?? null,
        proposed_action: input.proposed_action,
        expected_impact_pts: input.expected_impact_pts ?? null,
        estimated_cost_tnd: input.estimated_cost_tnd ?? null,
        estimated_timeline: input.estimated_timeline ?? null,
        risks: input.risks ?? [],
        recommendation: input.recommendation ?? null,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return {
      proposalId: data.id,
      status: "pending",
    };
  },
});

export const recordDecision = createTool({
  id: "record_decision",
  description:
    "Journalise une décision de Pr. Nadia et met à jour la proposition liée.",
  inputSchema: z.object({
    proposal_id: z.string().uuid().optional(),
    action_id: z.string().optional(),
    decision: z.enum(["approved", "deferred", "rejected"]),
    rationale: z.string().optional(),
  }),
  execute: async (input) => {
    if (!input.proposal_id && !input.action_id) {
      throw new Error("proposal_id ou action_id est requis pour record_decision.");
    }

    const { data: decision, error: decisionError } = await supabase
      .from("astaria_decisions")
      .insert({
        proposal_id: input.proposal_id ?? null,
        action_id: input.action_id ?? null,
        decision: input.decision,
        rationale: input.rationale ?? null,
      })
      .select("id, created_at")
      .single();

    if (decisionError) {
      throw decisionError;
    }

    if (input.proposal_id) {
      const { error } = await supabase
        .from("astaria_proposals")
        .update({
          status: input.decision,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", input.proposal_id);

      if (error) {
        throw error;
      }
    } else if (input.action_id) {
      const { error } = await supabase
        .from("astaria_proposals")
        .update({
          status: input.decision,
          resolved_at: new Date().toISOString(),
        })
        .eq("action_id", input.action_id)
        .eq("status", "pending");

      if (error) {
        throw error;
      }
    }

    return {
      decisionId: decision.id,
      decision: input.decision,
      recordedAt: decision.created_at,
    };
  },
});

export const requestTanitAction = createTool({
  id: "request_tanit_action",
  description:
    "Demande à Tanit d'exécuter une action déjà approuvée: rappel, résolution d'alerte, rapport, cycle de surveillance.",
  inputSchema: z.object({
    decision_id: z.string().uuid(),
    action_type: z.enum([
      "send_reminder",
      "mark_alert_resolved",
      "generate_cycle_report",
      "generate_report",
      "trigger_monitor_cycle",
    ]),
    parameters: z.record(z.string(), z.unknown()).optional().default({}),
  }),
  execute: async (input) => {
    const parameters = input.parameters ?? {};
    const { data: decision, error } = await supabase
      .from("astaria_decisions")
      .select("id, decision")
      .eq("id", input.decision_id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!decision || decision.decision !== "approved") {
      throw new Error(
        "request_tanit_action exige une décision Astaria approuvée avant exécution.",
      );
    }

    switch (input.action_type) {
      case "send_reminder": {
        const institutionId = String(parameters.institution_id ?? "");
        if (!institutionId) {
          throw new Error("institution_id est requis pour send_reminder.");
        }
        return callTanitApi(
          `/api/institutions/${encodeURIComponent(institutionId)}/remind`,
          {},
        );
      }
      case "mark_alert_resolved": {
        const alertId = String(parameters.alert_id ?? "");
        if (!alertId) {
          throw new Error("alert_id est requis pour mark_alert_resolved.");
        }
        return callTanitApi(`/api/alerts/${encodeURIComponent(alertId)}/resolve`, {});
      }
      case "generate_cycle_report":
      case "generate_report":
        return callTanitApi("/api/reports", parameters);
      case "trigger_monitor_cycle":
        return callTanitApi("/api/monitor", parameters);
    }
  },
});

export const updateMissionState = createTool({
  id: "update_mission_state",
  description:
    "Met à jour le statut d'une action du plan stratégique Astaria.",
  inputSchema: z.object({
    action_id: z.string().min(1),
    new_status: z.enum(["pending", "in_progress", "completed", "blocked"]),
    progress_pct: z.number().int().min(0).max(100).optional(),
    notes: z.string().optional(),
    captured_points: z.number().int().min(0).optional(),
  }),
  execute: async (input) => {
    const patch: Record<string, unknown> = {
      status: input.new_status,
      updated_at: new Date().toISOString(),
    };

    if (input.progress_pct !== undefined) {
      patch.current_progress_pct = input.progress_pct;
    }
    if (input.notes !== undefined) {
      patch.notes = input.notes;
    }
    if (input.captured_points !== undefined) {
      patch.captured_points = input.captured_points;
    }
    if (input.new_status === "in_progress") {
      patch.started_at = new Date().toISOString();
    }
    if (input.new_status === "completed") {
      patch.completed_at = new Date().toISOString();
      patch.current_progress_pct = 100;
    }

    const { data, error } = await supabase
      .from("astaria_mission_state")
      .update(patch)
      .eq("action_id", input.action_id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  },
});

export const generateMonthlyDigest = createTool({
  id: "generate_monthly_digest",
  description:
    "Demande à Tanit de générer le digest mensuel Astaria et de l'enregistrer dans les rapports.",
  inputSchema: z.object({
    period: z.string().optional().default("2026-04"),
    summary: z.string().optional(),
  }),
  execute: async (input) => {
    return callTanitApi("/api/reports", {
      institutionId: null,
      period: input.period,
      type: "astaria_monthly_digest",
      summary: input.summary,
    });
  },
});

export const logConversationSummary = createTool({
  id: "log_conversation_summary",
  description:
    "Insère un résumé de conversation Astaria en mémoire opérationnelle Supabase.",
  inputSchema: z.object({
    thread_id: z.string().optional(),
    summary: z.string().min(1),
    duration_minutes: z.number().int().min(0).optional(),
    register: z.string().optional(),
    outcomes: z
      .union([z.array(z.string()), z.record(z.string(), z.unknown())])
      .optional(),
    decisions_referenced: z.array(z.string().uuid()).optional(),
  }),
  execute: async (input) => {
    const { data, error } = await supabase
      .from("astaria_conversations")
      .insert({
        thread_id: input.thread_id ?? null,
        summary: input.summary,
        duration_minutes: input.duration_minutes ?? null,
        register: input.register ?? "présidentiel",
        outcomes: input.outcomes ?? [],
        decisions_referenced: input.decisions_referenced ?? [],
      })
      .select("id, created_at")
      .single();

    if (error) {
      throw error;
    }

    return {
      conversationId: data.id,
      createdAt: data.created_at,
    };
  },
});
