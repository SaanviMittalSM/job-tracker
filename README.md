# Job Application Tracker — Off-Campus Placement System

A tracking system for SDE intern/full-time applications: a dashboard, two independent automated discovery pipelines, and a BITS Pilani alumni referral workflow.

**Public repo:** [github.com/SaanviMittalSM/job-tracker](https://github.com/SaanviMittalSM/job-tracker) — contains the dashboard, discovery code, and `postings.json` (job listings only — titles/URLs/deadlines, nothing personal). Your resume stays local-only (`.gitignore`'d) and is never pushed here.

## Files

- `index.html` — the dashboard. Open it directly in any browser. No server, no install. Your edits (status, alumni contact, notes) save to that browser's local storage; discovered postings sync in from GitHub automatically on load.
- `postings.json` — machine-written by the discovery automation below. Don't hand-edit; it gets overwritten.
- `scripts/discover.js` + `.github/workflows/discover.yml` — the Greenhouse/Lever discovery automation (runs on GitHub's infrastructure, not dependent on any Claude session).
- This README.

**Backup habit:** local storage is per-browser and can be cleared. Click **Export JSON** in the dashboard weekly and keep the file somewhere synced. **Import JSON** restores from a backup.

---

## 1. What's in the dashboard

Seeded with 100+ companies across Global Big Tech, Global SaaS/Cloud, Indian Product/Fintech, Quant/Finance, AI Research/Frontier, **Voice/Speech AI** (your highest-leverage tier given your ML/voice-AI target roles — Plivo, Deepgram, AssemblyAI, ElevenLabs, Sarvam AI, Uniphore, Skit.ai, Ola Krutrim...), IT Services, and job aggregator portals (LinkedIn Jobs, Glassdoor, Naukri, Wellfound, Instahyre, Cutshort, Hirist, Internshala, SpeechTechJobs).

Each row tracks: category, role, **postings** (one or more direct links + deadlines, auto-populated where possible), **status**, **applied date** (auto-stamped — see below), alumni contact, outreach status, **outreach-sent date** (auto-stamped), last synced/checked, notes.

**No manual date typing.** `dateApplied` auto-fills the day you move Status to Applied-or-later; `outreachDate` auto-fills the day you move Outreach to Sent-or-later. The old skill/interest/comp-level fit-score fields were removed — sort/filter by category and postings instead.

---

## 2. Automated discovery — two independent pipelines

### Pipeline A: GitHub Actions + Greenhouse/Lever APIs (primary, fully automatic)

`scripts/discover.js` calls the **public, unauthenticated** job-board APIs that Greenhouse and Lever expose for exactly this purpose (not scraping — these are documented APIs meant for programmatic reads). `.github/workflows/discover.yml` runs it every 8 hours entirely on GitHub's infrastructure — no Claude session, no API key, no cost, keeps running even if you never open this chat again. It currently covers 22 companies confirmed on these platforms (Anthropic, Figma, Databricks, Scale AI, AssemblyAI, Stripe, Slice, GitLab, Elastic, MongoDB, Cloudflare, Okta, Zscaler, Twilio, Dropbox, Postman, xAI, Plivo, CRED, Meesho, Porter, Freshworks), filters for India-located + entry-level titles, and commits results straight to `postings.json`.

### Pipeline B: scheduled Claude routine + WebSearch (secondary, broader net)

For companies not on Greenhouse/Lever (Sarvam AI, Krutrim, Uniphore, Skit.ai, Gnani.ai, most Indian Product/Fintech companies, AI Research/Frontier), a scheduled cloud routine runs daily (~8 AM IST), does targeted web searches, and — once repo write access is confirmed working — commits its findings to the same `postings.json`. Manage it at [claude.ai/code/routines](https://claude.ai/code/routines) (routine: "Daily India job posting discovery — priority tier").

### How the dashboard consumes both

On every page load, `index.html` fetches `postings.json` straight from `raw.githubusercontent.com` (works even from a local file, since that's a remote HTTPS request, not a local one) and merges new postings/deadlines in automatically — no manual "sync" step required, though a **🔄 Sync from GitHub** button exists for forcing an immediate refresh.

### What's still manual

Companies not covered by either pipeline (most Global Big Tech, Quant/Finance, IT Services, and aggregator portals) fall back to a one-click **check** button per row — no typing, just marks "checked today" so the stale-row highlighting stays honest.

---

## 3. BITS Pilani alumni referral workflow

I don't automate LinkedIn (no scraping, no auto-connect, no auto-send — violates their ToS and risks your account) and I won't build bulk contact-scraping tools for the same underlying reason: pulling people's personal emails/phone numbers without consent for unsolicited outreach is a privacy/ToS problem regardless of which tool does it. **ContactOut** (a legitimate paid B2B contact-data product operating within its own compliance framework) is the sanctioned path if/when you get an account — ask and I'll wire up the lookup step. Until then:

### Step 1 — Find alumni (5-10 min per company)

**LinkedIn People search:** School filter → "Birla Institute of Technology and Science, Pilani", Current company filter → target company, optionally add "Software Engineer"/"SDE" to keywords.

**Google fallback:**
```
site:linkedin.com/in "BITS Pilani" "<Company Name>" software engineer
```

Log what you find in the row's **Alumni Contact** cell, set Outreach to "Alumni Identified".

### Step 2 — Message templates (personalize every time)

**A. Connection note (300 char LinkedIn limit):**
> Hi [Name], I'm a CS junior at BITS Pilani applying for [Role] at [Company]. Saw you're on the [team] team — would love to connect and hear about your experience there.

**B. After they accept:**
> Hi [Name], thanks for connecting! I'm finishing my B.E. in CS at BITS Pilani (2027) — I just wrapped a SWE internship at Honeywell building infra/observability tooling (cut a LaunchDarkly integration's billed connections ~80% by re-architecting the SDK usage), and I've been building backend/ML-systems projects since — most recently a FastAPI + Qdrant document platform load-tested to 700+ docs/min. I just applied for [Role] at [Company] and would really appreciate a referral if you think it's a fit — happy to send my resume over. No worries at all if you're not able to!

**C. Thank-you (send regardless of outcome):**
> Really appreciate you taking the time, [Name] — means a lot regardless of how it turns out. Hope our paths cross again!

### Step 3 — Track it

Outreach status: `Message Drafted` → `Sent` (auto-stamps the date) → `Responded - Positive` / `Responded - No Referral` / `No Response`. One polite bump after ~10 days of silence is fine; more reads as pushy.

---

## 4. Roadmap — mobile app + real backend

Agreed direction: a PWA (installable, no app store needed) backed by a real database (Supabase — Postgres + auto-generated REST API + auth, free tier) instead of browser-only local storage, so your data syncs across devices.

**Status: blocked on Supabase account creation** — that step needs your direct sign-up (email/OAuth + ToS acceptance), which I can't do on your behalf. Once you have a project, share the project URL + anon key (safe to share, designed to be client-visible) and I'll wire up: the PWA manifest + service worker, migrating the dashboard's local-storage logic to Supabase calls, and pointing the discovery pipelines at the database directly instead of (or alongside) `postings.json`.

---

## 5. Suggested daily loop

1. Open the dashboard — it auto-syncs from GitHub on load. Skim anything new.
2. For any row with an interesting posting you haven't applied to: apply on the portal, flip Status to Applied (date auto-stamps).
3. For strong-fit companies you've applied to: start alumni search, draft + send 2-3 messages max/day.
4. Use the **check** button on non-automated rows you looked at manually.
5. Export JSON backup weekly.
