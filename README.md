# Docu3C — Trademark Risk Assessment System

AI-powered trademark conflict assessment for the proposed mark **TEAR, POUR, LIVE MORE** (Classes 5 & 32) against 120 USPTO records.

## Quick Start

```bash
npm install
npm start
# Open http://localhost:3000
```

## Project Structure

```
docu3c-trademark-risk/
├── server.js          # Express API + risk engine + Knowledge Graph
├── data/
│   └── trademarks.json  # 120 USPTO trademark records
├── public/
│   └── index.html     # Attorney-facing UI
├── methodology.md     # Risk scoring methodology (TMEP-grounded)
├── llm_usage.md       # AI tool usage documentation
└── README.md
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/assessments` | Full risk assessment + graph data |
| `GET /api/graph` | Knowledge Graph nodes & edges |
| `GET /api/record/:id` | Single trademark record detail |

## How It Works

1. **Knowledge Graph** built with nodes: TargetMark, Class 5, Class 32, 6 TMEP Rule nodes, 120 TrademarkRecord nodes
2. **Graph traversal** retrieves candidate records via class membership edges
3. **Risk engine** scores each record using Jaccard token similarity (60%) + dominant-word phonetic overlap (40%)
4. **Rule-based classification** assigns HIGH/MEDIUM-HIGH/MEDIUM/MEDIUM-LOW/LOW with documented TMEP citations
5. **Uncertainty handling**: borderline confidence → flagged for attorney review

## Git Commits

- **Initial commit** `[first SHA]`: Basic Express server + data loading
- **Final submission** `[final SHA]`: Full Knowledge Graph + methodology + rule-based risk engine + attorney UI

See `methodology.md` for full risk scoring documentation.
See `llm_usage.md` for AI tool usage.

> ⚠️ This is an engineering prototype. Not legal advice.