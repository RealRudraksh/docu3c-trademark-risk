const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Load USPTO dataset
let trademarks = [];
try {
    const dataPath = path.join(__dirname, 'data', 'trademarks.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    trademarks = JSON.parse(rawData);
} catch (err) {
    console.error("Error loading trademarks.json:", err);
}

// Target Mark details from assignment
const TARGET_MARK = "TEAR, POUR, LIVE MORE";
const TARGET_CLASSES = [5, 32];

// Helper: Calculate string similarity (Levenshtein-based or token overlap)
function calculateStringSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    if (s1 === s2) return 1.0;

    const words1 = s1.split(/[\s,]+/);
    const words2 = s2.split(/[\s,]+/);
    let commonWords = 0;

    words1.forEach(w => {
        if (words2.includes(w)) commonWords++;
    });

    return commonWords / Math.max(words1.length, words2.length);
}

// Knowledge Graph & Risk Assessment Engine
function assessRisks() {
    // Constructing in-memory Knowledge Graph nodes and edges
    const graph = {
        nodes: {
            target: { id: "TARGET_MARK", name: TARGET_MARK, classes: TARGET_CLASSES },
            records: trademarks,
            tmep_rules: [
                { id: "TMEP_1207_01", desc: "Likelihood of Confusion - Similar marks and related goods/services" }
            ]
        },
        edges: []
    };

    const assessments = trademarks.map(record => {
        // 1. Check Class Intersection
        const sharedClasses = record.classes.filter(c => TARGET_CLASSES.includes(c));
        const classOverlap = sharedClasses.length > 0;

        // 2. Check Name Similarity
        const nameSim = calculateStringSimilarity(TARGET_MARK, record.mark);

        // 3. Determine Risk Level & Evidence based on TMEP Logic
        let riskLevel = "LOW";
        let evidence = [];
        let tmepCitation = "TMEP § 1207.01(a)";

        if (classOverlap && nameSim > 0.6) {
            riskLevel = "HIGH";
            evidence.push(`Exact or high phonetic/token similarity match ('${record.mark}').`);
            evidence.push(`Direct overlap in International Classes: ${sharedClasses.join(', ')}.`);
        } else if (classOverlap && nameSim > 0.3) {
            riskLevel = "MEDIUM-HIGH";
            evidence.push(`Moderate name similarity to target mark.`);
            evidence.push(`Shares identical or closely related classes: ${sharedClasses.join(', ')}.`);
        } else if (classOverlap || nameSim > 0.5) {
            riskLevel = "MEDIUM";
            evidence.push(classOverlap ? `Shares class context (${sharedClasses.join(', ')})` : `Moderate lexical similarity.`);
        } else if (nameSim > 0.2) {
            riskLevel = "MEDIUM-LOW";
            evidence.push(`Low-level term overlap, distinct classification or context.`);
        } else {
            riskLevel = "LOW";
            evidence.push(`Minimal similarity in text and non-conflicting goods/services classification.`);
            tmepCitation = "N/A - Insufficient nexus";
        }

        // Add edge to Knowledge Graph dynamically
        graph.edges.push({
            source: "TARGET_MARK",
            target: record.id,
            relationship: classOverlap ? "SHARED_CLASS_CONFLICT" : "DISSIMILAR",
            risk: riskLevel
        });

        return {
            id: record.id,
            mark: record.mark,
            status: record.status,
            owner: record.owner,
            classes: record.classes,
            serial_number: record.serial_number,
            risk_level: riskLevel,
            evidence: evidence,
            tmep_citation: tmepCitation
        };
    });

    // Sort assessments by risk severity priority
    const riskPriority = { "HIGH": 1, "MEDIUM-HIGH": 2, "MEDIUM": 3, "MEDIUM-LOW": 4, "LOW": 5 };
    assessments.sort((a, b) => riskPriority[a.risk_level] - riskPriority[b.risk_level]);

    return { graph, assessments };
}

// API Endpoint to get Risk Assessments and Graph Data
app.get('/api/assessments', (req, res) => {
    const result = assessRisks();
    res.json(result);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});