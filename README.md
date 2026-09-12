# Signal

A private job-search inbox you deploy in your own Cloudflare account. Track listings, choose search preferences, save résumé and portfolio evidence, and optionally generate editable cover letters using your own OpenAI API project.

## Get started — no coding experience needed

Give this link to **Codex or Claude Code**:

**https://raw.githubusercontent.com/greddmbamboo/signal-template/main/SET-UP-SIGNAL.md**

Copy this message:

> Please set up Signal for me using https://raw.githubusercontent.com/greddmbamboo/signal-template/main/SET-UP-SIGNAL.md. Handle the technical work and walk me through anything you need me to do, one step at a time.

Your assistant downloads the app and helps you set it up. You need a Cloudflare account and a domain you control. AI cover letters are optional and require your own paid OpenAI API account. Start with job tracking and add cover letters later.

You can also [read the setup file](SET-UP-SIGNAL.md), or open it above and use **Download raw file** to attach it to your assistant.

## Included

- Cloudflare Workers and D1, with Cloudflare Access email-PIN authentication.
- Empty first-run onboarding with installer-defined roles and locations.
- Optional Brave web discovery plus Jobicy, Remote OK, and Arbeitnow feeds; employer-site follow-up; manual imports including Dayforce.
- Inbox, Needs review, Applied, Rejected, and Passed filters; Sources and Preferences under Settings.
- [Optional Brave setup and search limits](docs/brave-search.md).
- Private job status, notes, and saved cover letters scoped to verified identity.
- Optional AI generation from approved evidence; tracking works without an API key.
- Editable letters and PDF export.

## Checks

```sh
npm ci
npm test
```

The suite uses local D1 and mocked external services. No cloud credentials are required. Production Access sign-in and a real model request must be checked in the installer's deployment.

## Boundaries

This is a private-instance template, not a shared commercial service. No billing, credits, automatic applications, or public signup. Résumés support pasted text and `.txt` import; native PDF/DOCX parsing and automatic portfolio fetching are not included. Feed coverage and location matching are approximate. Review job eligibility and every letter before use.

## Updating an existing installation

Signal 0.2.0 and later show an update notice when a newer stable release is available. Copy the update message into your assistant to start a guided update. Existing 0.1.0 installations need this first update manually: give [UPDATE-SIGNAL.md](https://raw.githubusercontent.com/greddmbamboo/signal-template/main/UPDATE-SIGNAL.md) to your assistant in your Signal project. No update is installed automatically.

Maintainers: see [release instructions](docs/releasing.md).
