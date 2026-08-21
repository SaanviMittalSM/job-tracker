# Job Application Tracker — Off-Campus Placement System

A PWA for tracking SDE/ML/backend/cloud intern & new-grad applications: live job-posting discovery, a private per-account dashboard, Gmail-based response detection with an in-app notification center, and a BITS Pilani alumni referral workflow.

**Live app:** [saanvimittalsm.github.io/job-tracker](https://saanvimittalsm.github.io/job-tracker/) — sign in with Google.
**Public repo:** [github.com/SaanviMittalSM/job-tracker](https://github.com/SaanviMittalSM/job-tracker) — contains the app + discovery code + `companies_snapshot.json` (company list only, nothing personal). Your resume stays local-only, never pushed here.
**Backend:** Supabase (Postgres). `postings` and `companies` are public tables (job-listing data, non-sensitive). `applications` and `gmail_signals` are private, RLS-scoped per signed-in user.

---

## 1. Automated discovery — two pipelines, very different capabilities

### Pipeline A: GitHub Actions + official company APIs (fully automatic, zero manual steps)

`scripts/discover.js` calls the **public, unauthenticated** job-board APIs that Greenhouse, Lever, and Amazon expose for exactly this purpose — not scraping, these are documented endpoints. `.github/workflows/discover.yml` runs it every 8 hours on GitHub's own infrastructure — no Claude session involved, keeps running even if this chat is never opened again. Currently covers **37 companies** confirmed on these platforms (systematically probed against the full company list, not hand-picked), including Anthropic, Databricks, Stripe, GitLab, MongoDB, Twilio, Plivo, CRED, Meesho, Razorpay, Amazon, and more. Uses replace-semantics each run (deletes-then-reinserts its own postings) so closed roles don't linger as stale data.

The same workflow also exports `companies_snapshot.json` — the current company list plus which ones are API-covered — and commits it. This is what makes Pipeline B dynamic instead of hardcoded (see below).

### Pipeline B: scheduled Claude routines + WebSearch (broader net, needs a manual merge step)

For the ~86 companies without a discoverable public API (most Global Big Tech, Quant/Finance, IT Services, Voice/Speech AI startups, Indian product companies), two scheduled routines run WebSearch, managed at [claude.ai/code/routines](https://claude.ai/code/routines):

- **"Weekly new-company discovery"** — researches genuinely new, relevant companies to add to the tracker (funded startups, YC-backed, voice-AI, fintech). Caps at 6 additions/run to keep quality high.
- **"Big Tech/Quant/IT-Services job discovery"** — searches the dynamic non-API-covered company list (read from `companies_snapshot.json`, not hardcoded) for specific, targeted postings.

**Hard platform constraint, confirmed by direct testing (not assumed):** these routines run in a sandboxed environment that (a) blocks outbound network calls to Supabase, and (b) blocks `git push` (403, even though `git clone`/`pull` work fine). Their **only** output channel is their final answer text. This means Pipeline B cannot be fully hands-off — someone has to read the routine's output and write it into Supabase. That's the "merge cycle" below.

### What's still fully manual

Aggregator portals (Naukri, Wellfound, LinkedIn Jobs, etc.) aren't employers — they're places *you* search, not places postings get pulled *from*. No automation applies to them; use the one-click **check** button per row if you look at one manually.

---

## 2. The merge cycle — how Pipeline B's results actually get into the dashboard

Since the routine can't write anywhere itself, this is a repeatable procedure (originally manual, now scripted down to two commands):

1. **Fetch the routine's latest output.** Via the `RemoteTrigger` tool: `list_runs` on the routine to find the latest session, then `get_run_log` to pull its final report text (the structured `### Category / **Company** / - Title - URL - deadline` format it's instructed to produce).
2. **Save the report text** to a local file, e.g. `scratch/report.txt`.
3. **Run the merge script:**
   ```
   node scripts/merge_report.js scratch/report.txt
   ```
   This parses the report and upserts into Supabase (`postings` + `company_checks`). It automatically **filters out generic company-homepage links** (bare domains, `/careers` with nothing else) — those get printed separately for manual review instead of silently inserted as if they were real targeted postings. Only genuinely specific role postings (real req IDs, program pages with an actual application path) go in.
4. **Spot-check** the skipped list the script prints — if a "generic" flag was a false positive (occasionally a program page like a campus-hiring track is legitimately targeted despite a short URL), insert it manually the same way `merge_report.js` does internally, or loosen the check for that one case.
5. **Re-run tests:** `node tests/run-all.js` to confirm the merge didn't break anything.

Both routines are on a **3-day cadence**. In practice: every ~3 days, ask me to check the routines and merge — I run steps 1-5. This isn't zero-touch, but it's the honest ceiling given the sandbox's network/git restrictions confirmed above; anything claiming to be more automatic than this for Pipeline B would be overstating what the platform allows.

---

## 3. Gmail response detection + notification center

A separate daily routine ("Daily Gmail application signal scan") searches your connected Gmail (`mittalsaanvi14@gmail.com`) for direct company-to-candidate application activity — confirmations, interview invites, rejections, offers — explicitly **excluding** anything relayed through the BITS Pilani campus placement cell (tracked separately, out of scope for this tool). Same manual-merge constraint applies: the routine reports findings as text; merging into the `gmail_signals` table is a manual insert (smaller volume than job postings, so no dedicated script yet — ask me to check and merge when needed).

Once in `gmail_signals`, the app surfaces them via the **🔔 notification bell** in the header: a badge shows the pending count, clicking it opens a panel per finding with **Apply** (sets that row's status + auto-stamps the date, matches by company name) or **Dismiss**. If you've granted browser notification permission (the bell prompts for it), new signals also trigger a native OS notification while the tab is open.

---

## 4. BITS Pilani alumni referral workflow

I don't automate LinkedIn (scraping/auto-connect/auto-send violates their ToS and risks your account) and won't build bulk contact-scraping tools for the same underlying reason — pulling people's personal contact info without consent for unsolicited outreach is a privacy problem regardless of mechanism. **ContactOut** (a legitimate paid B2B contact-data product) is the sanctioned path if/when you get an account.

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

## 5. Testing

`node tests/run-all.js` runs the full suite (unit — role-filter regex logic; integration — live Supabase RLS/schema checks; functional — live pipeline run + deployed-asset reachability). Run it after any change to `discover.js`, the schema, or `index.html`'s data layer.

---

## 6. Suggested loop (every few days)

1. Open the app — auto-loads live from Supabase. Check the 🔔 bell for new Gmail-detected responses.
2. For interesting postings you haven't applied to: apply on the portal, flip Status to Applied (date auto-stamps).
3. For strong-fit companies you've applied to: alumni search, draft + send 2-3 messages max/day.
4. Every ~3 days: ask me to run the merge cycle (§2) so Pipeline B's findings land in the dashboard.
5. Export JSON backup weekly (button in the header).
