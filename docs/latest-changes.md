# Shared updates from the private Signal instance

- Compact jobs header, larger filter counts, no filter icons, and a standalone Settings gear. Sources and Preferences are separate from job filters.
- Rejected application tracking; applied jobs offer Mark rejected instead of Pass.
- Removed Flagged. Existing saved/flagged records return to Inbox without losing notes or letters; eligibility determines their display.
- Optional Brave role/location discovery, cached queries, persistent reports, 900-request monthly installation cap, and bounded aggregator-to-employer follow-up.
- Explicitly out-of-criteria discovered jobs stay out of Inbox/Needs review. Uncertain, unverified, or old observations remain reviewable. Manual and tracked records are preserved.
- Canonical-URL deduplication; feed refreshes no longer deactivate jobs absent from a bounded response. Employer-verified records cannot be downgraded by later aggregator data.
- Complete Dayforce imports and rejection of generic placeholder pages.
- Full-page manual import now reads structured data, embedded application state, employer wrappers, and supported ATS pages before falling back to visible page content.
- Work-arrangement parsing lets explicit hybrid and required office attendance override misleading remote metadata, and installer-defined country/state eligibility is enforced consistently.
- The old heuristic fit score is replaced by evidence evaluation: job responsibilities are matched only to approved résumé and portfolio evidence; location and legitimacy are separate pass/review gates.
- In Progress is available as a first-class application state.
- Cover letters now analyze the hiring need first, select only verifiable evidence, open with a specific reason the role caught the candidate's eye, and run an independent factual/voice edit.

## Upgrade requirements

Apply the new additive 0003 migration to the existing database after backing it up, following UPDATE-SIGNAL.md. It adds search_cache and search_usage only. Preserve all existing migration history, Access configuration, profiles, records, and secrets. Brave is optional and needs the installer's own server-side key. No OpenAI or personal credentials are distributed.

This checkout retains standalone Cloudflare Access authentication, blank onboarding, installer-defined locations, evidence approval, saved letters, and the existing update checker. It does not copy private or demo seed data, identity details, credentials, or deployment configuration. These changes are published in Signal 0.4.0. The update manifest is advanced only after the tagged release exists.
