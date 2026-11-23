# 🌬️ AuraPulse — Urban Air Quality Action Planner

> **PromptWars Virtual Challenge 6** — Google for Developers × Hack2Skill

AuraPulse is a **dual-engine environmental platform** that translates hyper-local air quality telemetry into zero-hallucination daily action plans for families, commuters, and vulnerable individuals.

## 🧩 Architecture

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React (Vite) + Component-scoped CSS |
| **Backend** | Node.js + Express (ES Modules) |
| **Database** | PostgreSQL via Supabase |
| **Cache** | Upstash Serverless Redis |
| **AI** | Google Gemini 2.5 Flash (structured JSON output) |
| **APIs** | Google Maps Air Quality API, Routes API, Open-Meteo |

## 🏗️ Project Structure

```
aurapulse/
├── backend/           # Express API server
│   ├── src/config/    # DB, Redis, Google API, Gemini clients
│   ├── src/engine/    # Deterministic physics (zero AI math)
│   ├── src/services/  # External API integrations
│   ├── src/controllers/
│   ├── src/routes/
│   └── src/middleware/
└── frontend/          # React (Vite) SPA
    └── src/components/ # 1:1 JSX + CSS per component
```

## 🚀 Getting Started

```bash
# 1. Copy and fill environment variables
cp .env.example backend/.env

# 2. Install all dependencies
npm run install:all

# 3. Start both servers
npm run dev
```

## 📄 License

MIT
