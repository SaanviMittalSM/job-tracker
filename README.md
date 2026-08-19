# Job Application Tracker — Off-Campus Placement System

A local, self-contained system for tracking SDE intern/full-time applications, systematically working through career portals + job aggregators, and running BITS Pilani alumni referral outreach.

## Files

- `index.html` — the dashboard. Open it directly in any browser (double-click, or drag into a tab). No server, no install. Data auto-saves to that browser's local storage.
- `saanvi_s_latex_resume_final.pdf` — your resume (used below to tailor the fit rubric and message templates).
- This README — the workflow that ties it together.

**Backup habit:** local storage is per-browser and can be cleared. Click **Export JSON** in the dashboard weekly (or after big updates) and keep the file somewhere synced (OneDrive/Drive). **Import JSON** restores from a backup or lets you move data to another machine.

---

## 1. What's in the dashboard

Seeded with 100+ entries across:

| Category | Examples |
|---|---|
| Global Big Tech | Google, Microsoft, Amazon, Meta, Nvidia, LinkedIn, Netflix... |
| Global SaaS/Cloud | Stripe, Databricks, Cloudflare, MongoDB, Figma, Notion... |
| Indian Product/Fintech | Flipkart, Razorpay, CRED, Meesho, Zoho, Juspay, Rapido... |
| Quant/Finance | Goldman Sachs, JP Morgan, Optiver, D E Shaw... |
| AI Research/Frontier | OpenAI, Anthropic, DeepMind, HuggingFace, Cohere, xAI... |
| **Voice/Speech AI** | Plivo, Deepgram, AssemblyAI, ElevenLabs, Sarvam AI, Uniphore, Skit.ai, Ola Krutrim... |
| IT Services | TCS, Infosys, Wipro, Accenture... (safety net tier) |
| Aggregator Portal | LinkedIn Jobs, Glassdoor, Naukri, Wellfound, Instahyre, Cutshort, Hirist, Internshala, SpeechTechJobs |

The **Voice/Speech AI** category exists specifically because your resume/portfolio trajectory is aimed at ML/voice-AI roles (Plivo-style JD) — treat it as your highest-leverage tier, not an afterthought next to the Big Tech names.

Add any company or portal I missed with **+ Add Row**. Everything (status, dates, scores, notes) is editable inline — click a cell.

---

## 2. Weekly rotation workflow (instead of ad hoc checking)

Aggregator scraping across 70+ differently-built portals isn't reliable — most are JS-rendered and structures differ, so an automated "tell me when something new opens" bot would silently miss postings and give false confidence. The **Last Checked** column + rotation queue solves this without automation risk:

1. Click **Show weekly rotation queue** — this sorts every row by oldest-checked-first (blank = oldest).
2. Pick your session size (e.g. 15 companies/aggregators a day). Open each portal link, check for new SDE intern/new-grad postings, and:
   - If something's open and you haven't applied: update **Status**.
   - Either way: set **Last Checked** to today.
3. Rows untouched for 7+ days get a yellow left-edge highlight so stale ones are visually obvious even outside the rotation view.
4. The **Aggregator Portal** rows (LinkedIn Jobs, Glassdoor, Naukri, Wellfound, etc.) go through the same rotation — checking 9 aggregators covers postings from companies not on your seed list too, which is the real way to "cast a broad net" without me scraping every individual company site.

This gets you through the full list roughly once a week with ~15-20 min/day instead of one overwhelming pass.

---

## 3. Fit score rubric

Three sub-scores (1–5 each), averaged into a color-coded chip (green ≥4, yellow 2.5–4, red <2.5):

- **Skill** — overlap with your actual stack: Python/TypeScript/C++, FastAPI/Node backend, PostgreSQL/SQLite/**Qdrant** (vector DB), Docker/K8s/CI-CD, Scikit-Learn/TensorFlow, and — as the voice-agent project lands — ASR/speech/turn-taking. A role wanting backend + ML systems work scores high; a pure frontend or pure DevOps role scores low regardless of brand.
- **Interest** — alignment with where you're steering your career (ML/voice-AI, backend/distributed systems, applied ML infra). Score IT-services-style generic SDE roles low even if you'd take them as a safety net.
- **Comp/Level** — intern stipend, new-grad comp band, or judgment call for early-stage startups (equity-heavy, harder to score — use IMC/Optiver/Goldman as your high-comp reference point).

Don't over-tune this — it's there so `sort by Fit` surfaces your best-leverage applications first when you're deciding where to spend limited outreach effort, not a scientific formula.

---

## 4. BITS Pilani alumni referral workflow

I can't browse or automate LinkedIn — no scraping, no auto-connecting, no auto-sending messages, even with account access, because that violates LinkedIn's Terms of Service and risks your account being restricted. What follows is the manual (but fast) process; you execute the LinkedIn actions, the tracker keeps you organized.

### Step 1 — Find alumni (5-10 min per company)

**On LinkedIn directly (best signal):**
1. Go to LinkedIn **People search**.
2. Use the **School** filter → "Birla Institute of Technology and Science, Pilani".
3. Use the **Current company** filter → the target company.
4. Optional: add "Software Engineer" or "SDE" to keywords to skip non-eng alumni.

**Google fallback (when LinkedIn's own filters are being weird, or you want a quick scan first):**
```
site:linkedin.com/in "BITS Pilani" "<Company Name>" software engineer
```
Swap in each company name from the tracker.

Log what you find in the row's **Alumni Contact** cell (name + a short note, e.g. `Rohan K. – SDE2, joined 2023`), set **Outreach** to `Alumni Identified`.

### Step 2 — Draft the message (use these as starting points, always personalize)

Keep every message short — 3-5 sentences, one clear ask, easy to say yes to.

**A. Cold connection request note** (LinkedIn caps these at 300 characters — keep it tight):
> Hi [Name], I'm a CS junior at BITS Pilani applying for [Role] at [Company]. Saw you're on the [team, if known] team — would love to connect and hear about your experience there.

**B. First message after they accept (the actual ask):**
> Hi [Name], thanks for connecting! I'm finishing my B.E. in CS at BITS Pilani (2027) — I just wrapped a SWE internship at Honeywell building infra/observability tooling (cut a LaunchDarkly integration's billed connections ~80% by re-architecting the SDK usage), and I've been building backend/ML-systems projects since — most recently a FastAPI + Qdrant document platform load-tested to 700+ docs/min. I just applied for [Role] at [Company] ([link if useful]) and would really appreciate a referral if you think it's a fit — happy to send my resume over. No worries at all if you're not able to!

**C. If they ask for your resume / more context** — send the PDF directly, plus one line on why this specific role: e.g. for Voice/Speech AI companies, mention the multilingual voice-agent project explicitly once it's further along; for backend-heavy roles, lead with the Secure Document Platform and Honeywell work; for ML-heavy roles, lead with the sensor-fusion project's R² result (0.38 → 0.997) as evidence of real modeling depth, not just API glue.

**D. Thank-you (send regardless of outcome — this is what makes people refer you again next cycle):**
> Really appreciate you taking the time, [Name] — means a lot regardless of how it turns out. Hope our paths cross again!

### Step 3 — Track it

Update the row's **Outreach** status as you go: `Message Drafted` → `Sent` → `Responded - Positive` / `Responded - No Referral` / `No Response`. Set **Outreach Date** when you send. The dashboard's stats bar shows your response rate live, so you can tell if a particular message style is landing.

**No response after ~10 days?** One polite bump is fine, more than that reads as pushy — let it go and move to the next company.

---

## 5. Suggested daily loop

1. Rotation queue → check 10-15 companies/portals for new postings, update statuses (10 min).
2. For any `Not Started` row with Fit ≥ 4: apply on the portal, then start alumni search for that company (15-20 min).
3. Send 2-3 outreach messages max/day (quality over volume — mass-messaging alumni reads as spam and hurts your response rate).
4. Export JSON backup once a week.
