# SAIKO Construction AI — Web Prototype

A responsive front-end prototype for a construction management and AI assistant system.

## How to open

Option 1: Double-click `index.html`.

Option 2: Run a local web server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Included prototype modules

- Dashboard
- Projects
- AI Assistant (local demo responses)
- Estimate / BOQ preliminary calculator
- Cost Database
- Contracts & Documents
- Billing & Payments
- Variation Orders / EOT
- Procurement
- Project Monitoring

## What is not connected yet

This prototype does not yet use a live database or an AI API. For production, the next layer would be:

- Next.js/React frontend
- PostgreSQL database
- Authentication and user roles
- OpenAI API integration
- File upload and document generation
- Project-specific cost database
- Excel/PDF/Word export
