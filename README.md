# Tanit Agents — the Mastra layer

> *Tanit, the institutional platform. Astaria, the first Rooted AI specialist. Two agents on one stage.*

This is the **Mastra agent layer** behind [Project Tanit](https://github.com/maahdiwork-dev/tanit). Deployed on Railway, consumed by the Next.js frontend at [tanit-seven.vercel.app](https://tanit-seven.vercel.app).

**Live demo:** https://tanit-seven.vercel.app
**Agent API:** https://tanit-agents-production.up.railway.app
**Pitch site:** https://rooted-ai-omega.vercel.app
**Architecture:** https://rooted-ai-omega.vercel.app/architecture
**The team:** https://rooted-ai-omega.vercel.app/team

Submitted to **Hack4UCar 2026** · ENSTAB Borj Cédria · Université de Carthage.

---

## Two agents

### Tanit — the platform agent

The institutional orchestrator across 33 UCAR institutions. Coordinates submissions, validates data, detects anomalies, generates RAP/PAP reports, escalates blockers up the chain.

- **9 operational tools** — institution queries, KPI fetches, monitor cycles, audit trail, alert generation, report PDFs
- **3 multi-role tools** — `ocrDocument` (Gemini 2.5 Flash), `createTicket`, `escalateTicket` for the live cascade demo
- French + Arabic, multi-step reasoning, real Supabase tool calls
- Validation Agent + Coordination Agent are conceptual roles narrated to the audience — under the hood, both are Tanit invoking the relevant tool

### Astaria — the strategic companion

The first **Rooted AI specialist agent** — built for Pr. Nadia Mzoughi Aguir on the GreenMetric mission. Anchored at the Présidence, diffused across the institution.

- **12 strategic tools** — `getGreenMetricState`, `getStrategicPlanStatus`, `proposeAction`, `recordDecision`, `requestTanitAction`, `generateMonthlyDigest`, `logConversationSummary`, `readAstariaMemory`, etc.
- **4-layer memory** — identity (vault) · mission (Supabase) · relationship (conversations) · domain (GreenMetric methodology)
- **Pre-seeded mission state** — 13 actions tracked, 3 pending proposals, 1 active blocker (P1.1 plastic decree pending 4 weeks), 5 historical decisions, 2 past conversations, 1 documented win
- Speaks in formal French (the *présidentiel* register — *vous*, no contractions, structured prose). Vocabulary verified against Pr. Nadia's WhatsApp messages.

---

## Stack

| Layer | Tool |
|---|---|
| Agent framework | [Mastra](https://mastra.ai) (TypeScript) — v1.0+ stable, used in production by Replit, SoftBank, PayPal |
| AI providers | [Vercel AI SDK](https://ai-sdk.dev) — provider-agnostic abstraction |
| LLM routing | DeepSeek V3 (default, cost-effective) · Claude Sonnet · Qwen · Gemini 2.5 Flash (vision) |
| Conversation memory | `@mastra/libsql` (LibSQL/SQLite) |
| Operational state | Supabase Postgres |
| Deployment | Railway + Railpack (Paris region · ~200ms to Tunis) |

LLM-agnostic from day one. Swap providers with a one-line config change.

---

## Architecture

```
   Next.js frontend (Vercel)
              │
              ▼
   /api/astaria/chat  ◄──── proxy with SSE streaming
              │
              ▼
   Mastra agent server (Railway)
              │
   ┌──────────┴──────────┐
   │                     │
 Tanit               Astaria
   │                     │
   └──────────┬──────────┘
              ▼
   Supabase (shared, both read; only Tanit writes operational data)
```

**Design principle:** *"Tanit writes, Astaria reads."* No agent-to-agent messaging. Supabase IS the orchestrator. Each agent evolves independently.

Full architecture diagram with the 3-layer Rooted AI school deployment vision:
**→ https://rooted-ai-omega.vercel.app/architecture**

---

## Run locally

```bash
git clone https://github.com/maahdiwork-dev/tanit-agents.git
cd tanit-agents
npm install
cp .env.example .env
# fill in Supabase URL + service-role + DeepSeek/Gemini keys
npm run dev
```

Mastra dev server starts at http://localhost:4111. The frontend [`tanit`](https://github.com/maahdiwork-dev/tanit) reads from `MASTRA_URL` (default localhost in dev).

### Required env vars

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DEEPSEEK_API_KEY
GOOGLE_API_KEY              # for Gemini OCR
TANIT_API_URL               # for Astaria → Tanit cross-calls
ASTARIA_SEED_PATH           # path to astaria-seed/ vault (system prompt source)
```

See `.env.example` for the full list.

---

## Production deployment (Railway)

```bash
npm install -g @railway/cli
railway login
cd tanit-agents
railway link              # link to project "kind-simplicity"
railway up                # build + deploy via Railpack
railway domain            # get the public URL
```

Build configuration is in `railway.json`. Start command: `npm run start` → `node .mastra/output/index.mjs`. Node 22.13+.

---

## Why Mastra (not Claude Agent SDK, not LangGraph)

Documented decision from research:

- **Claude Agent SDK** — rejected. Anthropic-only by design, alpha-stage memory leaks (32GB consumed in <1 minute reported), subprocess wrapper that can't run inside Next.js routes
- **LangGraph** — wrong fit for single-agent conversational systems; designed for multi-agent autonomous routing
- **Mastra** — production-ready (v1.0 January 2026, used by Replit/SoftBank/PayPal), TypeScript-native, processors system handles tier routing, tool compatibility layer normalizes calls across providers (15% → 3% error rate)

Full research notes: https://rooted-ai-omega.vercel.app/architecture

---

## The team

Built in 24 hours by **one human + seven AI agents.** Full team documented at:
**→ https://rooted-ai-omega.vercel.app/team**

---

## Status

Hackathon submission · April 26, 2026 · Mahdi Kniss · Tunis.

---

*Same roots, new fruit.*
