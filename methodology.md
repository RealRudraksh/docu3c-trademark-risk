# Risk Methodology — TEAR, POUR, LIVE MORE Trademark Assessment

## Overview

This document defines the rule-based risk methodology used to assess 120 USPTO trademark records against the proposed mark **TEAR, POUR, LIVE MORE** (Classes 5 & 32).

Risk is **not** assigned by asking an LLM "is this HIGH or LOW?" — it is computed using deterministic, auditable rules grounded in TMEP provisions.

---

## Signals Used

### Signal 1: Token (Jaccard) Similarity — Weight: 60%

Measures the proportion of shared word tokens between the target mark and candidate mark.

```
tokenSim = |intersection(tokens_target, tokens_candidate)| / |union(tokens_target, tokens_candidate)|
```

Tokens are lowercased and punctuation-stripped before comparison.

### Signal 2: Phonetic / Dominant-Word Overlap — Weight: 40%

The dominant words in TEAR, POUR, LIVE MORE are: **TEAR**, **POUR**, **LIVE**, **MORE**.

```
phoneticSim = count(dominant words appearing in candidate) / 4
```

### Combined Similarity Score

```
combinedSim = (tokenSim × 0.6) + (phoneticSim × 0.4)
```

---

## Risk Level Rules (Applied in Order)

| Rule | Condition | Risk Level | Confidence Range |
|------|-----------|------------|------------------|
| 1 | Active status + class overlap (5 or 32) + combinedSim ≥ 0.50 | **HIGH** | 75–95% |
| 2 | Active status + class overlap + combinedSim 0.25–0.49 | **MEDIUM-HIGH** | 50–80% |
| 3a | Any status + class overlap + combinedSim 0.10–0.24 | **MEDIUM** | 35–60% |
| 3b | Any status + no class overlap + combinedSim ≥ 0.45 | **MEDIUM** | 35–55% |
| 4 | Abandoned/Cancelled + (class overlap OR combinedSim ≥ 0.20) | **MEDIUM-LOW** | 20–40% |
| 5 | All other cases | **LOW** | 15–30% |

---

## Confidence Score Derivation

Confidence is computed arithmetically from the combined similarity and base score per rule — it is not an arbitrary number.

Example (Rule 1):
```
confidence = min(95, round(60 + (combinedSim × 35)))
```

This means a mark with combinedSim = 0.80 gets confidence = min(95, 60+28) = 88%.

---

## Uncertainty Handling

When confidence falls below the rule's expected threshold, the system flags the record for **attorney escalation** rather than asserting a confident classification. This applies when:
- Rule 2 confidence < 65%
- Rule 3 applies to an abandoned/cancelled mark (confidence reduced by 15 points)
- Any borderline case where signals conflict

The system **abstains from certainty** and instead presents evidence for attorney review.

---

## TMEP Legal Grounding

All risk assessments cite verifiable TMEP provisions. Citations are never fabricated — they are drawn from a fixed reference table mapped to rule conditions:

| TMEP Provision | Applied When |
|----------------|-------------|
| § 1207.01 | All likelihood-of-confusion assessments |
| § 1207.01(a)(v) | Class/goods overlap detected |
| § 1207.01(b)(iv) | Phonetic/appearance similarity |
| § 1207.01(b)(viii) | Dominant feature of mark matches |
| § 1207.01(d)(i) | Active/enforceable mark status |
| § 1207.01(d)(iv) | Abandoned marks — not directly citable |

---

## Knowledge Graph Role

The Knowledge Graph is used functionally — not decoratively:

1. **Retrieval**: Class nodes (Class 5, Class 32) link to all trademark records sharing that class. The graph traversal `TARGET → CLASS → TM Records` retrieves candidates before similarity scoring.
2. **Assessment**: Each high-risk record receives a `POTENTIAL_CONFLICT` edge from the TARGET node, and an `ASSESSED_BY` edge to the applicable TMEP rule node.
3. **Evidence traceability**: An attorney can traverse: `TM Record → ASSESSED_BY → TMEP Rule → GOVERNED_BY → Class Node → REGISTERED_IN → TARGET` to trace any conclusion back to its source evidence.

---

## What This System Does NOT Do

- It does not perform Common Law, State Trademark, or Domain Name analysis.
- It does not use LLM hallucination to generate TMEP citations — all citations are from a verified reference table.
- It does not mark abandoned/cancelled records as direct conflicts (per TMEP § 1207.01(d)(iv)).
- It does not assign HIGH risk without both similarity AND class overlap evidence.