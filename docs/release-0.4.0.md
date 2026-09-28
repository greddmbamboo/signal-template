# Signal 0.4.0

Signal 0.4.0 brings the private app's current job-reading, location, evaluation, tracking, and cover-letter behavior to the self-hosted template without including private or demo data.

## What changed

- Manual imports read the job page itself, including JSON-LD, embedded application state, common employer wrappers, and supported ATS APIs.
- Explicit hybrid and office-attendance language overrides contradictory remote labels.
- Country and state restrictions are evaluated against the installer's saved locations.
- Job fit is evaluated from actual responsibilities matched to approved résumé and portfolio evidence. Location eligibility and listing legitimacy are shown as separate gates and never inflate the skill score.
- Applied jobs can move into an In Progress stage.
- Cover letters use a hiring-need and evidence-selection pass before drafting, then receive a separate factual and voice edit.

## Privacy and configuration

- Existing installations keep their own profile, jobs, status history, notes, saved letters, D1 data, Access configuration, and secrets.
- New installations still begin with blank onboarding.
- OpenAI remains optional. Without an OpenAI key, Signal continues to support search, imports, and job tracking; AI analysis and new cover-letter generation remain unavailable.
- No private-instance identity, résumé, portfolio evidence, fictional demo data, or API key is included.

## Update

Follow `UPDATE-SIGNAL.md`. No new database migration is required for 0.4.0; evaluation data is stored in the existing job payload.
