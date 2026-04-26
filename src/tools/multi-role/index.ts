import { createTool } from "@mastra/core/tools";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabaseUrl = process.env.SUPABASE_URL?.startsWith("http")
  ? process.env.SUPABASE_URL
  : "http://localhost:54321";

const supabase = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || "FILL_THIS",
);

const ticketKindSchema = z.enum([
  "missing_document",
  "invalid_data",
  "escalation",
  "manual_intervention",
]);

const escalationTargetSchema = z.enum(["director", "dean"]);

function googleKey() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key || key.includes("REPLACE_WITH")) {
    throw new Error("GOOGLE_API_KEY is not configured for Gemini OCR.");
  }

  return key;
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gemini did not return a JSON object.");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
}

function confidenceFromFillRatio(
  extracted: Record<string, unknown>,
  expectedFields: string[],
) {
  if (expectedFields.length === 0) return 0.7;
  const filled = expectedFields.filter((field) => {
    const value = extracted[field];
    return value !== null && value !== undefined && value !== "";
  }).length;
  return Math.round((filled / expectedFields.length) * 100) / 100;
}

async function currentSimulatedDate() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("current_simulated_date")
    .eq("id", "demo")
    .maybeSingle();

  if (error) throw error;
  return String(data?.current_simulated_date ?? new Date().toISOString());
}

async function resolveInstitutionId(institutionId: string) {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      institutionId,
    );
  const filters = [`acronym.eq.${institutionId}`, `code.eq.${institutionId}`];
  if (isUuid) {
    filters.unshift(`id.eq.${institutionId}`);
  }

  const { data, error } = await supabase
    .from("institutions")
    .select("id, acronym, code, domain")
    .or(filters.join(","))
    .maybeSingle();

  if (error) throw error;
  return data as
    | { id: string; acronym: string | null; code: string | null; domain: string | null }
    | null;
}

async function findEscalationOwner(ticket: {
  institution_id: string;
  metadata?: Record<string, unknown> | null;
}, to: "director" | "dean") {
  if (to === "director") {
    const institution = await resolveInstitutionId(ticket.institution_id);
    const keys = [
      ticket.institution_id,
      institution?.id,
      institution?.acronym,
      institution?.code,
    ].filter((value): value is string => Boolean(value));

    const { data, error } = await supabase
      .from("admin_staff_users")
      .select("id")
      .eq("role", "director")
      .in("institution_id", keys)
      .limit(1);

    if (error) throw error;
    return data?.[0]?.id as string | undefined;
  }

  const institution = await resolveInstitutionId(ticket.institution_id);
  const domain =
    institution?.domain ??
    (typeof ticket.metadata?.domain === "string" ? ticket.metadata.domain : null);
  if (!domain) return undefined;

  const { data, error } = await supabase
    .from("admin_staff_users")
    .select("id")
    .eq("role", "dean")
    .eq("domain", domain)
    .limit(1);

  if (error) throw error;
  return data?.[0]?.id as string | undefined;
}

export const ocrDocument = createTool({
  id: "ocr_document",
  description:
    "Extrait des KPIs depuis une photo de document avec Gemini Flash. Si ticket_id et institution_id sont fournis, enregistre les KPIs et résout le ticket.",
  inputSchema: z.object({
    image_url: z.string().min(1),
    context: z
      .object({
        ticket_id: z.string().uuid().optional(),
        institution_id: z.string().optional(),
        period: z.string().optional().default("2024-2025"),
        domain: z.string().optional().default("esg"),
        kpi_id: z.string().optional(),
        expected_fields: z.array(z.string()).optional().default([]),
        language: z.string().optional().default("fr"),
      })
      .optional()
      .default({
        period: "2024-2025",
        domain: "esg",
        expected_fields: [],
        language: "fr",
      }),
  }),
  execute: async (input) => {
    const context = input.context ?? {};
    const expectedFields = context.expected_fields ?? [];
    const google = createGoogleGenerativeAI({ apiKey: googleKey() });
    const prompt = [
      "Extract KPIs from this institutional paper document image.",
      "Return only JSON: {\"extracted\":{},\"confidence\":0.0,\"raw_text\":\"...\"}.",
      `Expected fields: ${JSON.stringify(expectedFields)}.`,
      `Context: ${JSON.stringify(context)}.`,
      "Use null for missing fields.",
    ].join("\n");

    const result = await generateText({
      model: google("gemini-2.5-flash"),
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: new URL(input.image_url) },
          ],
        },
      ],
    });

    const parsed = extractJsonObject(result.text);
    const extracted =
      parsed.extracted && typeof parsed.extracted === "object"
        ? (parsed.extracted as Record<string, unknown>)
        : {};
    const parsedConfidence = Number(parsed.confidence);
    const confidence = Number.isFinite(parsedConfidence)
      ? Math.max(0, Math.min(1, parsedConfidence))
      : confidenceFromFillRatio(extracted, expectedFields);

    if (confidence < 0.6) {
      return {
        ok: false,
        code: "OCR_LOW_CONFIDENCE",
        confidence,
        extracted,
        raw_text: typeof parsed.raw_text === "string" ? parsed.raw_text : result.text,
      };
    }

    if (context.institution_id) {
      const institution = await resolveInstitutionId(context.institution_id);
      if (!institution) {
        throw new Error(`Institution introuvable: ${context.institution_id}`);
      }

      const rows = Object.entries(extracted)
        .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
        .map(([metric, value]) => ({
          institution_id: institution.id,
          domain: context.domain ?? "esg",
          metric,
          value,
          period: context.period ?? "2024-2025",
          source: "gemini_ocr",
        }));

      if (rows.length) {
        const { error } = await supabase.from("kpis").insert(rows);
        if (error) throw error;
      }
    }

    if (context.ticket_id) {
      const resolvedAt = await currentSimulatedDate();
      const { error: updateError } = await supabase
        .from("tickets")
        .update({
          status: "resolved",
          resolved_at: resolvedAt,
          current_owner_user_id: null,
        })
        .eq("id", context.ticket_id);
      if (updateError) throw updateError;

      const { error: messageError } = await supabase.from("ticket_messages").insert({
        ticket_id: context.ticket_id,
        sender: "system",
        content: "Ticket résolu par Tanit après extraction OCR Gemini",
        metadata: { demo: "multi-role", ocr_result: { extracted, confidence } },
        created_at: resolvedAt,
      });
      if (messageError) throw messageError;
    }

    return {
      ok: true,
      extracted,
      confidence,
      raw_text: typeof parsed.raw_text === "string" ? parsed.raw_text : result.text,
      model: "gemini-2.5-flash",
    };
  },
});

export const createTicket = createTool({
  id: "create_ticket",
  description:
    "Crée un ticket multi-role, le premier message système et la notification initiale.",
  inputSchema: z.object({
    institution_id: z.string().min(1),
    kind: ticketKindSchema,
    title: z.string().min(1),
    description: z.string().optional(),
    current_owner_user_id: z.string().min(1),
    escalation_level: z
      .enum(["staff", "director", "dean", "tanit"])
      .optional()
      .default("staff"),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
  }),
  execute: async (input) => {
    const createdAt = await currentSimulatedDate();
    const inputMetadata = input.metadata ?? {};
    const metadata = {
      demo: "multi-role",
      ...inputMetadata,
      original_owner_user_id:
        inputMetadata.original_owner_user_id ?? input.current_owner_user_id,
    };
    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert({
        institution_id: input.institution_id,
        kind: input.kind,
        title: input.title,
        description: input.description ?? null,
        status: "open",
        escalation_level: input.escalation_level,
        current_owner_user_id: input.current_owner_user_id,
        created_at: createdAt,
        metadata,
      })
      .select("id, status, created_at")
      .single();

    if (error) throw error;

    const { error: messageError } = await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender: "system",
      content: "Ticket créé par l'agent de validation",
      metadata: { demo: "multi-role" },
      created_at: createdAt,
    });
    if (messageError) throw messageError;

    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: input.current_owner_user_id,
      role_target: "staff",
      scope_filter: { institution_id: input.institution_id },
      type: "submission_incomplete",
      payload: {
        demo: "multi-role",
        ticket_id: ticket.id,
        message: input.title,
      },
      read: false,
      created_at: createdAt,
    });
    if (notificationError) throw notificationError;

    return ticket;
  },
});

export const escalateTicket = createTool({
  id: "escalate_ticket",
  description:
    "Escalade un ticket multi-role vers le directeur ou le doyen, avec message audit et notification.",
  inputSchema: z.object({
    ticket_id: z.string().uuid(),
    to: escalationTargetSchema,
    reason: z.string().optional().default("no_response_24h"),
  }),
  execute: async (input) => {
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", input.ticket_id)
      .maybeSingle();

    if (ticketError) throw ticketError;
    if (!ticket) throw new Error(`Ticket introuvable: ${input.ticket_id}`);
    if (ticket.status === "resolved") {
      throw new Error(`Ticket déjà résolu: ${input.ticket_id}`);
    }

    const ownerId = await findEscalationOwner(ticket, input.to);
    if (!ownerId) {
      throw new Error(`Aucun propriétaire ${input.to} trouvé pour ce ticket.`);
    }

    const escalatedAt = await currentSimulatedDate();
    const { data: updated, error: updateError } = await supabase
      .from("tickets")
      .update({
        escalation_level: input.to,
        current_owner_user_id: ownerId,
        escalated_at: escalatedAt,
      })
      .eq("id", input.ticket_id)
      .select("id, escalation_level, current_owner_user_id, escalated_at")
      .single();

    if (updateError) throw updateError;

    const label = input.to === "director" ? "Directeur" : "Doyen";
    const content = `Escaladé au ${label} — aucune réponse après 24h`;

    const { error: messageError } = await supabase.from("ticket_messages").insert({
      ticket_id: input.ticket_id,
      sender: "system",
      content,
      metadata: {
        demo: "multi-role",
        from: ticket.escalation_level,
        to: input.to,
        reason: input.reason,
      },
      created_at: escalatedAt,
    });
    if (messageError) throw messageError;

    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .insert({
        user_id: ownerId,
        role_target: input.to,
        scope_filter: { institution_id: ticket.institution_id },
        type: "escalation_received",
        payload: {
          demo: "multi-role",
          ticket_id: input.ticket_id,
          message: content,
        },
        read: false,
        created_at: escalatedAt,
      })
      .select("id, role_target, user_id")
      .single();

    if (notificationError) throw notificationError;

    return {
      ticket: updated,
      notification,
    };
  },
});
