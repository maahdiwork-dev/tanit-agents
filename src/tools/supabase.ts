import { createTool } from "@mastra/core/tools";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabaseUrl = process.env.SUPABASE_URL?.startsWith("http")
  ? process.env.SUPABASE_URL
  : "http://localhost:54321";

const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || "FILL_THIS",
);

export const queryKPIs = createTool({
  id: "query_kpis",
  description: "Query KPI data from Supabase for one or all institutions",
  inputSchema: z.object({
    institution_id: z.string().optional(),
    domain: z.string().optional(),
    period: z.string().optional(),
  }),
  execute: async (context) => {
    let query = supabase.from("kpis").select("*");

    if (context.institution_id) {
      query = query.eq("institution_id", context.institution_id);
    }

    if (context.domain) {
      query = query.eq("domain", context.domain);
    }

    if (context.period) {
      query = query.eq("period", context.period);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data;
  },
});

export const createAlert = createTool({
  id: "create_alert",
  description: "Create an anomaly alert in Supabase",
  inputSchema: z.object({
    institution_id: z.string(),
    metric: z.string(),
    value: z.number(),
    threshold: z.number(),
    severity: z.enum(["critical", "warning", "info"]),
    message: z.string(),
  }),
  execute: async (context) => {
    const { data, error } = await supabase.from("alerts").insert(context);

    if (error) throw error;

    return data;
  },
});

export const checkMissingSubmissions = createTool({
  id: "check_missing_submissions",
  description:
    "Check which institutions have not submitted KPIs for the current period",
  inputSchema: z.object({
    period: z.string(),
  }),
  execute: async (context) => {
    const { data: allInstitutions } = await supabase
      .from("institutions")
      .select("id, name_fr, acronym");
    const { data: submissions } = await supabase
      .from("submissions")
      .select("institution_id")
      .eq("period", context.period)
      .eq("status", "validated");

    const submittedIds = submissions?.map((s) => s.institution_id) || [];
    const missing =
      allInstitutions?.filter((i) => !submittedIds.includes(i.id)) || [];

    return missing;
  },
});
