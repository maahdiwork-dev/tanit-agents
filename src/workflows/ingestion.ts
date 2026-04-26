import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createStep, createWorkflow } from "@mastra/core/workflows";

const supabaseUrl = process.env.SUPABASE_URL?.startsWith("http")
  ? process.env.SUPABASE_URL
  : "http://localhost:54321";

const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || "FILL_THIS",
);

const allowedDomains = [
  "academic",
  "finance",
  "hr",
  "research",
  "esg",
  "infrastructure",
] as const;

const kpiSchema = z.object({
  domain: z.enum(allowedDomains),
  metric: z.string().min(1),
  value: z.number().finite(),
});

const ingestionInputSchema = z.object({
  institutionId: z.string().min(1),
  period: z.string().min(1),
  kpis: z.array(kpiSchema).min(1),
});

const validationOutputSchema = z.object({
  institutionId: z.string(),
  period: z.string(),
  kpis: z.array(kpiSchema),
  valid: z.boolean(),
  issues: z.array(z.string()),
});

const storeOutputSchema = validationOutputSchema.extend({
  submissionId: z.string().nullable(),
  storedCount: z.number(),
});

const alertSchema = z.object({
  metric: z.string(),
  severity: z.string(),
  value: z.number(),
  threshold: z.number(),
  message: z.string(),
});

const ingestionOutputSchema = z.object({
  success: z.boolean(),
  submissionId: z.string().nullable(),
  validations: z.object({
    valid: z.boolean(),
    issues: z.array(z.string()),
  }),
  anomaliesDetected: z.number(),
  newAlerts: z.array(alertSchema),
});

const validateStep = createStep({
  id: "validate_submission",
  description: "Validate structured KPI submission payload",
  inputSchema: ingestionInputSchema,
  outputSchema: validationOutputSchema,
  execute: async ({ inputData }) => {
    const issues: string[] = [];

    for (const [index, kpi] of inputData.kpis.entries()) {
      if (!Number.isFinite(kpi.value)) {
        issues.push(`KPI ${index + 1}: valeur numérique invalide`);
      }

      if (kpi.value < 0) {
        issues.push(`KPI ${index + 1}: valeur négative non autorisée`);
      }
    }

    return {
      institutionId: inputData.institutionId,
      period: inputData.period,
      kpis: inputData.kpis,
      valid: issues.length === 0,
      issues,
    };
  },
});

const storeStep = createStep({
  id: "store_submission",
  description: "Store validated KPIs, submission status, validation, and audit",
  inputSchema: validationOutputSchema,
  outputSchema: storeOutputSchema,
  execute: async ({ inputData }) => {
    if (!inputData.valid) {
      return {
        ...inputData,
        submissionId: null,
        storedCount: 0,
      };
    }

    const now = new Date().toISOString();
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .upsert(
        {
          institution_id: inputData.institutionId,
          period: inputData.period,
          status: "validated",
          submitted_at: now,
        },
        { onConflict: "institution_id,period" },
      )
      .select("id")
      .single();

    if (submissionError) {
      throw submissionError;
    }

    const submissionId = submission.id as string;

    const { error: deleteError } = await supabase
      .from("kpis")
      .delete()
      .eq("institution_id", inputData.institutionId)
      .eq("period", inputData.period)
      .eq("source", "manual_submission");

    if (deleteError) {
      throw deleteError;
    }

    const rows = inputData.kpis.map((kpi) => ({
      institution_id: inputData.institutionId,
      domain: kpi.domain,
      metric: kpi.metric,
      value: kpi.value,
      period: inputData.period,
      source: "manual_submission",
    }));

    const { error: insertKpiError } = await supabase.from("kpis").insert(rows);
    if (insertKpiError) {
      throw insertKpiError;
    }

    const { error: validationError } = await supabase
      .from("validations")
      .insert({
        submission_id: submissionId,
        status: "valid",
        issues: [],
        checked_at: now,
      });

    if (validationError) {
      throw validationError;
    }

    const { error: auditError } = await supabase.from("audit_log").insert({
      actor: "Tanit Coordination Agent",
      action: "submission_validated",
      target: inputData.institutionId,
      details: `Soumission validée - ${rows.length} KPIs enregistrés pour la période ${inputData.period}`,
      created_at: now,
    });

    if (auditError) {
      throw auditError;
    }

    return {
      ...inputData,
      submissionId,
      storedCount: rows.length,
    };
  },
});

const anomalyStep = createStep({
  id: "detect_anomalies",
  description: "Detect KPI anomalies and create Supabase alerts",
  inputSchema: storeOutputSchema,
  outputSchema: ingestionOutputSchema,
  execute: async ({ inputData }) => {
    if (!inputData.valid || !inputData.submissionId) {
      return {
        success: false,
        submissionId: inputData.submissionId,
        validations: {
          valid: inputData.valid,
          issues: inputData.issues,
        },
        anomaliesDetected: 0,
        newAlerts: [],
      };
    }

    const thresholds: Record<
      string,
      { max?: number; min?: number; severity: "critical" | "warning"; message: string }
    > = {
      taux_reussite: {
        min: 80,
        severity: "critical",
        message: "Taux de réussite sous le seuil critique",
      },
      taux_abandon: {
        max: 15,
        severity: "critical",
        message: "Taux d'abandon au-dessus du seuil critique",
      },
      budget_execution: {
        max: 95,
        severity: "warning",
        message: "Exécution budgétaire au-dessus du seuil de vigilance",
      },
    };

    const newAlerts: Array<z.infer<typeof alertSchema>> = [];

    for (const kpi of inputData.kpis) {
      const threshold = thresholds[kpi.metric];
      if (!threshold) {
        continue;
      }

      const thresholdValue = threshold.max ?? threshold.min ?? 0;
      const breached =
        (threshold.max !== undefined && kpi.value > threshold.max) ||
        (threshold.min !== undefined && kpi.value < threshold.min);

      if (!breached) {
        continue;
      }

      const alert = {
        metric: kpi.metric,
        severity: threshold.severity,
        value: kpi.value,
        threshold: thresholdValue,
        message: threshold.message,
      };

      const { error } = await supabase.from("alerts").insert({
        institution_id: inputData.institutionId,
        metric: alert.metric,
        severity: alert.severity,
        value: alert.value,
        threshold: alert.threshold,
        message: alert.message,
        resolved: false,
      });

      if (error) {
        throw error;
      }

      newAlerts.push(alert);
    }

    return {
      success: true,
      submissionId: inputData.submissionId,
      validations: {
        valid: inputData.valid,
        issues: inputData.issues,
      },
      anomaliesDetected: newAlerts.length,
      newAlerts,
    };
  },
});

export const ingestionWorkflow = createWorkflow({
  id: "kpi-ingestion",
  description: "KPI ingestion, validation, storage, and anomaly detection",
  inputSchema: ingestionInputSchema,
  outputSchema: ingestionOutputSchema,
})
  .then(validateStep)
  .then(storeStep)
  .then(anomalyStep)
  .commit();
