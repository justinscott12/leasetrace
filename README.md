# LegalTrace - Commercial Lease Compliance

AI-powered commercial lease compliance checker for Florida property managers and landlords. Ensures your lease agreements comply with Florida Chapter 83 (landlord-tenant law) to avoid costly violations and legal disputes.

## Overview

LegalTrace is a specialized tool for property managers and landlords in Florida. It uses AI to analyze commercial lease agreements against Florida Chapter 83 statutes, identifying compliance issues and providing actionable recommendations to protect your property and avoid legal liability.

**Target Audience**: Property management companies, commercial landlords, real estate attorneys in Florida

## Key Features

- **Florida Chapter 83 Compliance** - Specialized analysis of commercial leases against Florida landlord-tenant statutes
- **Actionable Recommendations** - Specific wording changes and missing clauses to protect landlords
- **Property Manager-Friendly** - Clear, practical language (not legal jargon)
- **Risk Identification** - Highlights violations that could expose landlords to liability
- **Statute Citations** - Every recommendation cites the specific Florida statute it's based on
- **Modern UI** - Clean dashboard showing compliance score, recommendations, and missing clauses
- **Agentic AI** - Self-correcting, state-aware, human-in-the-loop workflow

## Tech Stack

### Backend
- **Python 3.12+** - Programming language
- **FastAPI** - Async web framework
- **LangGraph** - Agent orchestration
- **LangChain** - LLM framework
- **PostgreSQL 15+** - Primary database
- **pgvector** - Vector database extension for semantic search
- **MCP (Model Context Protocol)** - Statute query protocol
- **Redis** (optional) - Caching layer

### Frontend
- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Recharts** - Data visualization
- **shadcn/ui** - UI components
- **Vercel AI SDK** - AI integration

## Agentic Features

LegalTrace implements several key **agentic AI patterns**:

### 1. Stateful Workflow Orchestration (LangGraph)
- Uses LangGraph's `StateGraph` to manage multi-step workflow with persistent state
- Each node can read and modify shared state (`AuditState`)
- State persists across execution, allowing resumption after interruptions

### 2. Self-Correction Loops
- Agent can loop back to re-analyze if compliance score is too low (< 0.7)
- Conditional edges check compliance score and decide whether to continue or re-analyze
- Implements feedback loop: analyze → check → improve → re-analyze

### 3. Human-in-the-Loop (HITL) Interrupts
- Workflow pauses at the `human_review` node
- Execution is interrupted, waiting for human approval/feedback
- Human can: Approve, Edit, or Re-try with new context
- Workflow resumes from the interrupt point after human action

### 4. State-Aware Retrieval Planning
- Before querying statutes, the agent plans what to search for
- Analyzes document metadata (type, location, jurisdiction) to create retrieval strategy
- Uses the plan to filter and prioritize statute searches

### 5. Multi-Agent Critique Pattern
- After compliance analysis, a separate critique agent reviews the analysis
- Checks for hallucinations, inconsistencies, and confidence issues
- Can trigger self-correction if critique fails

### 6. Reasoning Trace (Transparency)
- UI shows real-time trace of agent's execution
- Displays which node is running, tool calls, and decision points
- Provides transparency into the agent's "thought process"

### 7. State Persistence & Resumability
- Uses `PostgresSaver` to checkpoint state after each node
- Can resume execution from any checkpoint
- Enables long-running audits that survive restarts

## Setup

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 15+ with pgvector extension

### Backend Setup

1. **Create virtual environment:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start database with Docker:**
   ```bash
   docker compose up -d postgres redis
   ```

5. **Initialize database:**
   ```bash
   python -m backend.db.session init_db
   ```

6. **Seed statutes:**
   ```bash
   python -m backend.db.seed
   ```

7. **Run backend:**
   ```bash
   uvicorn backend.api.main:app --reload
   ```

### Frontend Setup

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Run development server:**
   ```bash
   npm run dev
   ```

## Use Cases

### 1. Commercial Lease Agreement Audit
A property management company needs to audit a commercial lease agreement before signing with a new tenant. LegalTrace:
- Extracts clauses and identifies obligations
- Retrieves relevant Florida statutes
- Calculates compliance score
- Identifies high-risk clauses
- Provides specific recommendations with statute citations

### 2. Employment Contract Review
A startup needs to ensure their employment contracts comply with Florida employment law. LegalTrace:
- Analyzes employment terms
- Checks against Fla. Stat. Chapter 448
- Identifies missing required clauses
- Suggests improvements

### 3. Data Privacy Policy Audit
A tech company needs to ensure their privacy policy complies with Florida data protection laws. LegalTrace:
- Reviews privacy provisions
- Checks against Fla. Stat. Chapter 501
- Identifies security gaps
- Suggests enhancements

### 4. Contract Template Standardization
A law firm wants to standardize their commercial lease templates across all Florida properties. LegalTrace:
- Audits existing templates
- Identifies inconsistencies
- Creates compliance checklist
- Suggests template improvements

### 5. Pre-Litigation Document Review
A tenant is considering legal action and wants to review their lease for violations. LegalTrace:
- Identifies violations
- Calculates risk
- Provides evidence with statute links
- Suggests legal arguments

## API Endpoints

- `POST /audit` - Create new audit
- `POST /audit/{thread_id}/approve` - Resume from human review
- `GET /audit/{thread_id}/trace` - Get execution trace
- `GET /audit/{thread_id}/statute/{statute_id}` - Get statute details
- `GET /health` - Health check

## Project Structure

```
legaltrace/
├── backend/
│   ├── agents/          # LangGraph agents
│   │   ├── audit_graph.py  # Main workflow graph
│   │   └── nodes.py        # Graph nodes
│   ├── api/             # FastAPI application
│   │   ├── main.py         # FastAPI app
│   │   └── routes/         # API routes
│   ├── db/              # Database models and session
│   ├── lib/             # Utilities (embeddings, RRF, search)
│   ├── mcp/             # MCP server for statute queries
│   └── tests/           # Test suite
├── frontend/
│   ├── app/             # Next.js app directory
│   ├── components/      # React components
│   └── api/             # API routes
└── docker-compose.yml   # Docker Compose configuration
```

## Development

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

### Code Quality

```bash
# Backend linting
ruff check backend/

# Frontend linting
cd frontend
npm run lint
```

## Comparison: Agentic vs. Traditional RAG

| Feature | Traditional RAG | LegalTrace (Agentic) |
|---------|----------------|---------------------|
| **Workflow** | Single API call | Multi-step graph with state |
| **Adaptation** | Fixed pipeline | Self-correction loops |
| **Human Interaction** | None | HITL interrupts |
| **Planning** | None | State-aware retrieval planning |
| **Reflection** | None | Multi-agent critique |
| **Memory** | Stateless | Persistent state with checkpoints |
| **Transparency** | Black box | Reasoning trace |

## Current Limitations

1. **Statute Database** - Currently seeded with 10 mock Florida statutes
   - **Production**: Would need full Florida statutes database
   
2. **Document Types** - Optimized for commercial leases
   - **Future**: Can extend to employment, data privacy, etc.
   
3. **Jurisdiction** - Focused on Florida
   - **Future**: Can add other states/jurisdictions
   
4. **Document Editing** - Reviews analysis, doesn't edit source document
   - **Future**: Could add in-app document editor

## License

Copyright © 2024 Sunshine Tech Solutions LLC. All rights reserved.
