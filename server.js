const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ─── Load Trademark Data ───────────────────────────────────────────────────────
let trademarks = [];
try {
    const dataPath = path.join(__dirname, 'data', 'trademarks.json');
    trademarks = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`✅ Loaded ${trademarks.length} trademark records.`);
} catch (err) {
    console.error("❌ Error loading trademarks.json:", err.message);
}

const TARGET_MARK = "TEAR, POUR, LIVE MORE";
const TARGET_CLASSES = [5, 32];
const TARGET_GOODS = "vitamins, supplements, dietary supplements, energy drinks, sports drinks, electrolyte drinks";

// ─── TMEP Reference Table (Verifiable Citations) ──────────────────────────────
const TMEP_REFS = {
    confusion: "TMEP § 1207.01 — Likelihood of Confusion",
    domFeature: "TMEP § 1207.01(b)(viii) — Dominant Feature of a Mark",
    classOverlap: "TMEP § 1207.01(a)(v) — Relatedness of Goods/Services",
    activeStatus: "TMEP § 1207.01(d)(i) — Status of Cited Mark",
    abandonedSafe: "TMEP § 1207.01(d)(iv) — Abandoned Marks Not Citable",
    phonetic: "TMEP § 1207.01(b)(iv) — Appearance, Sound, and Meaning",
    sameOwner: "TMEP § 1207.01(d)(iii) — Same Owner Marks",
};

// ─── Knowledge Graph (NetworkX-style in-memory) ───────────────────────────────
// Nodes: Target, Classes, TMEP Rules, Trademark Records
// Edges: SHARES_CLASS, POTENTIAL_CONFLICT, GOVERNED_BY, DISTINCT
class KnowledgeGraph {
    constructor() {
        this.nodes = new Map();
        this.edges = [];
        this._initBaseNodes();
    }

    _initBaseNodes() {
        this.addNode("TARGET", { label: TARGET_MARK, type: "TargetMark", classes: TARGET_CLASSES, goods: TARGET_GOODS });
        this.addNode("CLASS_5", { label: "Class 5: Dietary Supplements & Vitamins", type: "Class" });
        this.addNode("CLASS_32", { label: "Class 32: Energy & Sports Drinks", type: "Class" });
        this.addNode("TMEP_CONFUSION", { label: TMEP_REFS.confusion, type: "LegalRule" });
        this.addNode("TMEP_DOM", { label: TMEP_REFS.domFeature, type: "LegalRule" });
        this.addNode("TMEP_CLASS", { label: TMEP_REFS.classOverlap, type: "LegalRule" });
        this.addNode("TMEP_STATUS", { label: TMEP_REFS.activeStatus, type: "LegalRule" });
        this.addNode("TMEP_ABANDONED", { label: TMEP_REFS.abandonedSafe, type: "LegalRule" });
        this.addNode("TMEP_PHONETIC", { label: TMEP_REFS.phonetic, type: "LegalRule" });

        // Target links to its classes
        this.addEdge("TARGET", "CLASS_5", "REGISTERED_IN");
        this.addEdge("TARGET", "CLASS_32", "REGISTERED_IN");
        // Classes governed by confusion rule
        this.addEdge("CLASS_5", "TMEP_CONFUSION", "GOVERNED_BY");
        this.addEdge("CLASS_32", "TMEP_CONFUSION", "GOVERNED_BY");
    }

    addNode(id, props) { this.nodes.set(id, { id, ...props }); }

    addEdge(source, target, relation, props = {}) {
        this.edges.push({ source, target, relation, ...props });
    }

    addTrademark(record) {
        const nid = `TM_${record.id}`;
        this.addNode(nid, {
            label: record.mark,
            type: "TrademarkRecord",
            owner: record.owner,
            status: record.status,
            serial: record.serial_number,
            classes: record.classes
        });
        // Class membership edges
        if (record.classes.includes(5)) this.addEdge(nid, "CLASS_5", "IN_CLASS");
        if (record.classes.includes(32)) this.addEdge(nid, "CLASS_32", "IN_CLASS");
        return nid;
    }

    addConflictEdge(nid, riskLevel, similarity) {
        const rel = (riskLevel === "HIGH" || riskLevel === "MEDIUM-HIGH")
            ? "POTENTIAL_CONFLICT" : "DISTINCT";
        this.addEdge("TARGET", nid, rel, { risk: riskLevel, similarity });
        this.addEdge(nid, "TMEP_CONFUSION", "ASSESSED_BY");
    }

    getSummary() {
        return {
            total_nodes: this.nodes.size,
            total_edges: this.edges.length,
            nodes: [...this.nodes.values()],
            edges: this.edges,
            node_type_counts: this._countTypes()
        };
    }

    _countTypes() {
        const counts = {};
        for (const n of this.nodes.values()) {
            counts[n.type] = (counts[n.type] || 0) + 1;
        }
        return counts;
    }
}

// ─── Similarity Functions ──────────────────────────────────────────────────────
function tokenSimilarity(str1, str2) {
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const t1 = new Set(normalize(str1));
    const t2 = new Set(normalize(str2));
    if (t1.size === 0 || t2.size === 0) return 0;
    const intersection = [...t1].filter(t => t2.has(t)).length;
    return intersection / Math.max(t1.size, t2.size); // Jaccard
}

function phoneticOverlap(str1, str2) {
    // Check if dominant words appear in both marks
    const dominantWords = ["tear", "pour", "live", "more"];
    const s2 = str2.toLowerCase();
    const matchCount = dominantWords.filter(w => s2.includes(w)).length;
    return matchCount / dominantWords.length;
}

// ─── Rule-Based Risk Engine (Documented Methodology) ──────────────────────────
// Rules derived from TMEP § 1207.01 DuPont factors:
// 1. Similarity of marks (appearance, sound, meaning)
// 2. Relatedness of goods/services (class overlap)
// 3. Status of cited mark (active marks carry more weight)
// 4. Dominant feature matching

function computeRisk(record) {
    const sharedClasses = record.classes.filter(c => TARGET_CLASSES.includes(c));
    const classOverlap = sharedClasses.length > 0;
    const tokSim = tokenSimilarity(TARGET_MARK, record.mark);
    const phonSim = phoneticOverlap(TARGET_MARK, record.mark);
    const isActive = ["Registered", "Renewed", "Published", "Pending"].includes(record.status);
    const isAbandoned = ["Abandoned", "Cancelled"].includes(record.status);

    // Combined similarity score (weighted)
    const combinedSim = (tokSim * 0.6) + (phonSim * 0.4);

    let riskLevel = "LOW";
    let confidence = 0;
    let evidence = [];
    let tmepCitations = [];
    let escalation = false;

    // ── Rule 1: HIGH — Active mark, same class, high similarity ──────────────
    if (isActive && classOverlap && combinedSim >= 0.5) {
        riskLevel = "HIGH";
        confidence = Math.min(95, Math.round(60 + (combinedSim * 35)));
        evidence.push(`Token similarity ${(tokSim * 100).toFixed(0)}% + phonetic overlap ${(phonSim * 100).toFixed(0)}% with direct class intersection (Class ${sharedClasses.join(', ')}).`);
        evidence.push(`Active status (${record.status}) means this mark is enforceable and likely to be cited by USPTO examiner.`);
        evidence.push(`Dominant shared words: ${["TEAR", "POUR", "LIVE", "MORE"].filter(w => record.mark.toUpperCase().includes(w)).join(', ')}.`);
        tmepCitations = [TMEP_REFS.confusion, TMEP_REFS.domFeature, TMEP_REFS.activeStatus];
    }

    // ── Rule 2: MEDIUM-HIGH — Active mark, same class, moderate similarity ───
    else if (isActive && classOverlap && combinedSim >= 0.25) {
        riskLevel = "MEDIUM-HIGH";
        confidence = Math.round(50 + (combinedSim * 40));
        evidence.push(`Moderate combined similarity (${(combinedSim * 100).toFixed(0)}%) with shared Class ${sharedClasses.join(', ')}.`);
        evidence.push(`Active ${record.status} mark — still citable under Section 2(d).`);
        tmepCitations = [TMEP_REFS.confusion, TMEP_REFS.classOverlap, TMEP_REFS.activeStatus];
        if (confidence < 65) escalation = true;
    }

    // ── Rule 3: MEDIUM — Same class but low similarity OR high sim no class ──
    else if ((classOverlap && combinedSim >= 0.1) || (!classOverlap && combinedSim >= 0.45)) {
        riskLevel = "MEDIUM";
        confidence = Math.round(35 + (combinedSim * 30) + (classOverlap ? 10 : 0));
        if (classOverlap) {
            evidence.push(`Class overlap (Class ${sharedClasses.join(', ')}) exists but mark phrasing is sufficiently distinct.`);
            tmepCitations = [TMEP_REFS.classOverlap, TMEP_REFS.phonetic];
        } else {
            evidence.push(`High mark similarity (${(combinedSim * 100).toFixed(0)}%) but no direct class overlap — related goods risk possible.`);
            tmepCitations = [TMEP_REFS.confusion, TMEP_REFS.phonetic];
        }
        if (isAbandoned) {
            evidence.push(`Note: Mark is ${record.status} — not directly citable but shows crowded field.`);
            tmepCitations.push(TMEP_REFS.abandonedSafe);
            confidence = Math.max(30, confidence - 15);
            escalation = true;
        }
    }

    // ── Rule 4: MEDIUM-LOW — Abandoned/cancelled with some overlap ───────────
    else if (isAbandoned && (classOverlap || combinedSim >= 0.2)) {
        riskLevel = "MEDIUM-LOW";
        confidence = Math.round(20 + (combinedSim * 20));
        evidence.push(`${record.status} mark — not directly citable under TMEP § 1207.01(d)(iv), but contributes to crowded-field analysis.`);
        tmepCitations = [TMEP_REFS.abandonedSafe, TMEP_REFS.confusion];
        escalation = true;
    }

    // ── Rule 5: LOW — Insufficient nexus ─────────────────────────────────────
    else {
        riskLevel = "LOW";
        confidence = Math.max(15, Math.round(combinedSim * 30));
        evidence.push(`Insufficient similarity (${(combinedSim * 100).toFixed(0)}%) and no overlapping classes — negligible conflict risk.`);
        tmepCitations = ["N/A — Distinct mark, no conflict expected."];
    }

    return { riskLevel, confidence, evidence, tmepCitations, escalation, combinedSim, sharedClasses };
}

// ─── Main Assessment Pipeline ──────────────────────────────────────────────────
let assessmentsCache = null;

function runAssessment() {
    const kg = new KnowledgeGraph();
    const results = [];

    for (const record of trademarks) {
        const { riskLevel, confidence, evidence, tmepCitations, escalation, combinedSim, sharedClasses } = computeRisk(record);

        // Add to Knowledge Graph
        const nid = kg.addTrademark(record);
        kg.addConflictEdge(nid, riskLevel, combinedSim);
        if (tmepCitations.includes(TMEP_REFS.domFeature)) kg.addEdge(nid, "TMEP_DOM", "ASSESSED_BY");
        if (tmepCitations.includes(TMEP_REFS.phonetic)) kg.addEdge(nid, "TMEP_PHONETIC", "ASSESSED_BY");

        results.push({
            id: record.id,
            mark: record.mark,
            status: record.status,
            owner: record.owner,
            classes: record.classes,
            shared_classes: sharedClasses,
            serial_number: record.serial_number,
            risk_level: riskLevel,
            confidence,
            evidence,
            tmep_citations: tmepCitations,
            escalation_needed: escalation,
            similarity_score: parseFloat((combinedSim * 100).toFixed(1))
        });
    }

    // Sort by risk priority
    const riskOrder = { HIGH: 1, "MEDIUM-HIGH": 2, MEDIUM: 3, "MEDIUM-LOW": 4, LOW: 5 };
    results.sort((a, b) => riskOrder[a.risk_level] - riskOrder[b.risk_level] || b.confidence - a.confidence);

    const graph = kg.getSummary();

    return {
        assessments: results, graph, meta: {
            target_mark: TARGET_MARK,
            target_classes: TARGET_CLASSES,
            total_analyzed: results.length,
            high_risk_count: results.filter(r => r.risk_level === "HIGH").length,
            medium_high_count: results.filter(r => r.risk_level === "MEDIUM-HIGH").length,
            escalation_count: results.filter(r => r.escalation_needed).length,
            graph_nodes: graph.total_nodes,
            graph_edges: graph.total_edges
        }
    };
}

// ─── API Routes ────────────────────────────────────────────────────────────────
app.get('/api/assessments', (req, res) => {
    if (!assessmentsCache) assessmentsCache = runAssessment();
    res.json(assessmentsCache);
});

app.get('/api/graph', (req, res) => {
    if (!assessmentsCache) assessmentsCache = runAssessment();
    res.json(assessmentsCache.graph);
});

app.get('/api/record/:id', (req, res) => {
    if (!assessmentsCache) assessmentsCache = runAssessment();
    const item = assessmentsCache.assessments.find(a => a.id === parseInt(req.params.id));
    item ? res.json(item) : res.status(404).json({ error: "Record not found" });
});

// Serve index.html for all other routes
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n🚀 Docu3C Trademark Risk Server running at http://localhost:${PORT}`);
    console.log(`📊 /api/assessments  — Full risk assessment`);
    console.log(`🕸️  /api/graph        — Knowledge Graph data`);
    console.log(`🔍 /api/record/:id   — Single record detail\n`);
});