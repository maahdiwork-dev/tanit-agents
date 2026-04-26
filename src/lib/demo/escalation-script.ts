import type { SupabaseClient } from "@supabase/supabase-js";

export type Beat =
  | {
      type: "escalate";
      ticket_id: string;
      from: "staff" | "director";
      to: "director" | "dean";
    }
  | {
      type: "notification_inserted";
      id: string;
      role_target: "director" | "dean";
      user_id: string | null;
    }
  | {
      type: "noop";
      reason: string;
    };

type TicketRow = {
  id: string;
  institution_id: string;
  escalation_level: "staff" | "director" | "dean" | "tanit";
  status: string;
  current_owner_user_id: string | null;
  created_at: string;
  escalated_at: string | null;
  metadata: Record<string, unknown> | null;
};

async function currentSimulatedDate(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("app_settings")
    .select("current_simulated_date")
    .eq("id", "demo")
    .maybeSingle();

  if (error) throw error;
  return String(data?.current_simulated_date ?? new Date().toISOString());
}

function hoursBetween(start: string, end: string) {
  return (new Date(end).getTime() - new Date(start).getTime()) / 36e5;
}

async function findDirector(supabase: SupabaseClient, institutionId: string) {
  const { data, error } = await supabase
    .from("admin_staff_users")
    .select("id")
    .eq("role", "director")
    .eq("institution_id", institutionId)
    .limit(1);

  if (error) throw error;
  return data?.[0]?.id as string | undefined;
}

async function findDean(supabase: SupabaseClient, institutionId: string) {
  const { data: institution, error: institutionError } = await supabase
    .from("institutions")
    .select("domain")
    .or(`acronym.eq.${institutionId},code.eq.${institutionId}`)
    .maybeSingle();

  if (institutionError) throw institutionError;
  const domain = institution?.domain as string | undefined;
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

async function escalate(
  supabase: SupabaseClient,
  ticket: TicketRow,
  to: "director" | "dean",
  simulatedDate: string,
) {
  const ownerId =
    to === "director"
      ? await findDirector(supabase, ticket.institution_id)
      : await findDean(supabase, ticket.institution_id);

  if (!ownerId) {
    return [{ type: "noop", reason: `No ${to} owner found` } satisfies Beat];
  }

  const { error: updateError } = await supabase
    .from("tickets")
    .update({
      escalation_level: to,
      current_owner_user_id: ownerId,
      escalated_at: simulatedDate,
    })
    .eq("id", ticket.id);

  if (updateError) throw updateError;

  const label = to === "director" ? "Directeur" : "Doyen";
  const content = `Escaladé au ${label} — aucune réponse après 24h`;
  const { error: messageError } = await supabase.from("ticket_messages").insert({
    ticket_id: ticket.id,
    sender: "system",
    sender_user_id: null,
    content,
    metadata: {
      demo: "multi-role",
      from: ticket.escalation_level,
      to,
      reason: "no_response_24h",
    },
    created_at: simulatedDate,
  });

  if (messageError) throw messageError;

  const { data: notification, error: notificationError } = await supabase
    .from("notifications")
    .insert({
      user_id: ownerId,
      role_target: to,
      scope_filter: { institution_id: ticket.institution_id },
      type: "escalation_received",
      payload: {
        demo: "multi-role",
        ticket_id: ticket.id,
        message: content,
      },
      read: false,
      created_at: simulatedDate,
    })
    .select("id, role_target, user_id")
    .single();

  if (notificationError) throw notificationError;

  return [
    {
      type: "escalate",
      ticket_id: ticket.id,
      from: ticket.escalation_level as "staff" | "director",
      to,
    },
    {
      type: "notification_inserted",
      id: notification.id as string,
      role_target: notification.role_target as "director" | "dean",
      user_id: notification.user_id as string | null,
    },
  ] satisfies Beat[];
}

export async function runNextBeat(
  supabase: SupabaseClient,
): Promise<{ actions: Beat[]; newSimulatedDate: string }> {
  const simulatedDate = await currentSimulatedDate(supabase);
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("status", "open")
    .in("escalation_level", ["staff", "director"])
    .order("created_at", { ascending: true });

  if (error) throw error;

  const tickets = (data ?? []) as TicketRow[];
  const staffTicket = tickets.find(
    (ticket) =>
      ticket.escalation_level === "staff" &&
      hoursBetween(ticket.created_at, simulatedDate) >= 24,
  );
  if (staffTicket) {
    return {
      actions: await escalate(supabase, staffTicket, "director", simulatedDate),
      newSimulatedDate: simulatedDate,
    };
  }

  const directorTicket = tickets.find(
    (ticket) =>
      ticket.escalation_level === "director" &&
      hoursBetween(ticket.escalated_at ?? ticket.created_at, simulatedDate) >=
        24,
  );
  if (directorTicket) {
    return {
      actions: await escalate(supabase, directorTicket, "dean", simulatedDate),
      newSimulatedDate: simulatedDate,
    };
  }

  return {
    actions: [{ type: "noop", reason: "No eligible scripted escalation" }],
    newSimulatedDate: simulatedDate,
  };
}
