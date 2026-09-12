# Signal 0.3.0

## What's new

- Optional Brave web search driven by your roles and locations, without a company allowlist.
- Bounded follow-up of aggregator results to locate and verify employer listings.
- Dayforce listing imports, including embedded job details.
- Clearer filtering: explicit mismatches are hidden; uncertain listings stay in Needs review.
- Rejected application tracking, canonical-URL deduplication, and preservation of saved letters and tracked jobs.
- A simpler header, larger filter counts, and Sources/Preferences under a standalone Settings gear.

## Upgrading

Follow [UPDATE-SIGNAL.md](https://github.com/greddmbamboo/signal-template/blob/v0.3.0/UPDATE-SIGNAL.md) in your existing project. Back up your database and preserve your configuration, secrets, profiles, and custom changes.

This release adds migration **0003**: `search_cache` and `search_usage` tables. Apply only unapplied migrations to your existing database before deploying; do not reset or replace it. Legacy saved/flagged states return to Inbox without losing notes or letters.

Brave is optional. Supply your own server-side `BRAVE_SEARCH_API_KEY` to enable it; free feeds remain usable without it. Search has a 24-hour cache and a 900-request monthly installation safeguard, not a guarantee of provider credits or free usage. See [Brave setup](https://github.com/greddmbamboo/signal-template/blob/v0.3.0/docs/brave-search.md).

Existing installations are not automatically upgraded. This release retains blank onboarding, Cloudflare Access sign-in, and installer-owned API credentials. It contains no private Signal profiles or secrets.

## Validation

Production build and 36 automated tests pass, covering imports, filtering, tracking, user isolation, and authentication. Live provider availability and quotas depend on each installation's accounts.
