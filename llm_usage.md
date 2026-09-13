# LLM Usage Documentation

## Tools Used
- **Claude (Anthropic)** — Architecture design, methodology review, TMEP research
- **GitHub Copilot** — Code completion for Express routes and DOM manipulation

---

## What AI Was Used For

### 1. TMEP Research & Citation Verification
Used Claude to identify the correct TMEP sections governing likelihood-of-confusion analysis (DuPont factors). Key provisions verified against the live USPTO TMEP online before hardcoding into the reference table.

**AI suggestion accepted:** The TMEP § 1207.01 subsection structure (a)(v) for goods relatedness, (b)(iv) for phonetic similarity, (d)(i)/(d)(iv) for status considerations.

**How validated:** Each citation was cross-checked against https://tmep.uspto.gov before inclusion. No citation is LLM-generated at runtime — all are from a static, human-verified reference table in `server.js`.

### 2. Knowledge Graph Schema Design
Used Claude to reason about what should be a node vs. an edge in the trademark conflict domain.

**AI suggestion accepted (with modification):** Initial suggestion included "Goods/Services" as separate nodes. Modified to use Class nodes only (more tractable for 120 records) with goods described in node properties.

**AI suggestion rejected:** Suggestion to use Neo4j — rejected in favor of in-memory graph (NetworkX-style) to keep deployment simple and reproducible without a database dependency.

### 3. Risk Scoring Logic
Used Claude to propose initial weighted similarity scoring. Accepted the Jaccard token similarity approach. Modified the weights (60/40 token/phonetic split vs. AI's suggested 50/50) after testing showed phonetic overlap was over-weighting partial matches like "MORLIFE."

**How validated:** Manually reviewed top 10 HIGH-risk records and confirmed they were the expected conflicting marks (LIVEMORE, TEAR. POUR. LOVE., TEARIOT, etc.).

### 4. Code Scaffolding
Copilot assisted with Express server boilerplate and HTML table rendering. All generated code was reviewed and modified — particularly the graph summary display and filter logic.

---

## AI-Generated Code Rejected

- Rejected a suggestion to call an LLM API at runtime to rate each trademark. This would make outputs non-deterministic and TMEP citations potentially fabricated. Replaced with deterministic rule engine.
- Rejected suggestion to use regex-based phonetic matching (Soundex). Replaced with dominant-word overlap which is more interpretable for attorneys.

---

## Validation of AI-Assisted Work

All risk assessments were spot-checked:
- TOP 5 HIGH records confirmed as genuine conflicts (LIVEMORE in Class 32, TEARIOT in Class 32, etc.)
- TMEP citations verified against USPTO TMEP online
- Confidence scores verified to be arithmetically derived, not arbitrary