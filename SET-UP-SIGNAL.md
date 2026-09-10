# Set up Signal for me

Give this file to Codex or Claude Code and say:

> Please set up Signal for me. Follow the attached instructions and guide me through anything you need me to do.

Signal gives you a private place to find and track jobs. Cover-letter generation is optional and uses your own paid OpenAI API account. Your assistant will do the technical setup. You will need to sign into Cloudflare, choose a domain or subdomain you control, and approve any costs. You can start without AI cover letters.

---

## Instructions for the assistant

Help this person get a working private Signal instance, not just another set of instructions. Use the canonical technical guide included below.

### Download Signal

Repository: https://github.com/greddmbamboo/signal-template
Source ZIP: https://github.com/greddmbamboo/signal-template/archive/refs/heads/main.zip

Download and extract the source ZIP into a new folder, or clone the repository. Do this yourself using your available tools. The person does not need a GitHub account. Do not use a similarly named messaging app or another Signal repository.

### Required setup order

**Complete all possible work before asking the person for account or domain information.** Do not open with “Do you have a Cloudflare account?” or “Do you already control a domain?” Do not interrupt local preparation with an account questionnaire.

1. Inspect the current folder and available tools. Download and extract Signal into a dedicated new folder. Preserve existing projects and deployments. Install dependencies, run the local tests, and resolve local failures that you can fix. Prepare configuration using placeholders for account-dependent values. Do not require a GitHub account or ask the person to run commands you can run yourself.
2. When all work that does not require their cloud account is complete, say:

   > We now need a Cloudflare account to host your Signal Job-Finder app. [Click here to log in or create an account](https://dash.cloudflare.com/). Once you're signed in, I'll walk you through the rest.

   Open that link for them when browser tools are available. Let them enter credentials and complete sign-in themselves. Do not ask them to paste passwords, tokens, or API keys into chat. If an authenticated account is already available, use that evidence instead of asking them to sign in again; confirm which account to use if there is a choice.
3. After sign-in, handle account authorization and resource setup with your available tools. Initiate Wrangler login when needed and guide the person through its authorization screen. Inspect accessible accounts and domains rather than asking for information you can obtain. Explain each required user action in plain language, one action at a time, and continue doing the work as soon as it is possible.
4. Resolve the domain only at the point it is needed. If an existing domain is available, suggest a suitable Signal subdomain and ask for that choice. If none is available, explain that this version needs a domain, then guide them through connecting one they own or registering one. Do not buy anything or change existing DNS without appropriate authorization. Creating an account alone does not satisfy the domain requirement.
5. Create their new database, configure the private Access email-sign-in policy, deploy the new instance within their authorization, and verify it. When a step must happen in the dashboard, take them to the relevant page when possible and tell them the next exact action; do not hand them a long checklist of technical tasks. Preserve existing deployments.
6. Start with working job tracking. Offer optional cover letters afterward; if wanted, walk them through their own OpenAI project, billing controls, and a hosted secret. Ask for approval before paid actions. Do not make optional AI credentials a prerequisite for local preparation or job tracking.
7. Finish by opening or linking their working Signal URL and helping them sign in, complete onboarding, and add their first job. If a step is blocked, explain precisely what is needed and complete any remaining independent work. Do not claim deployment or verification succeeded when it did not.

Keep the technical guide below as your own execution reference. Show the person only what they need for the current step. Do not silently change the hosting or authentication architecture to avoid a prerequisite.

---

## Canonical technical guide

# Set up your private Signal instance

This is the canonical setup guide for both Codex and Claude Code. Each installer owns their Cloudflare Worker, D1 database, Access policy, and optional OpenAI project and API key. No shared backend, subscription credits, or existing deployment is required.

## 1. Prepare the app locally

Download and extract [the Signal source](https://github.com/greddmbamboo/signal-template/archive/refs/heads/main.zip), or clone https://github.com/greddmbamboo/signal-template.git. Your assistant should do this for you. A personal GitHub account or repository is not required. Do not publish the development repository's old Git history. Keep your repository private if you later put personal configuration in it.

Install Node.js 22.13 or later, Git, and npm. From your new checkout:

```sh
npm ci
npm test
```

Tests create temporary local databases, sign synthetic Access tokens, and mock outbound services. They require no cloud credentials or OpenAI key. The runtime opens a loopback port.

## 2. Create your Cloudflare resources

Only begin this phase after completing all possible local preparation and checks in step 1. Use the login/create-account handoff above, then guide the person through authentication with `npx wrangler login`. Confirm the selected account before creating resources. Inspect available domains after sign-in and resolve the hostname when it is needed; do not ask about accounts or domains before local work is complete.

```sh
npx wrangler d1 create signal-db
```

In `wrangler.jsonc`, set a unique Worker `name` and replace the placeholder `database_id` with the new database ID. Set `database_name` to the name you created. Keep the binding named `DB`. Never copy a database ID from another person's deployment.

Add a custom-domain route, using your actual hostname:

```json
"routes": [{ "pattern": "signal.example.com", "custom_domain": true }]
```

Keep `workers_dev` and `preview_urls` set to `false`. All application API routes also validate Access tokens; an alternate origin must never rely only on an email header. The Vite plugin reads the Worker config and generates deployment output. See [Cloudflare Vite configuration](https://developers.cloudflare.com/workers/vite-plugin/reference/api/).

## 3. Protect the hostname with email sign-in

Before publishing, create a Cloudflare Zero Trust **self-hosted Access application** for the entire hostname, with no path restriction. Create an **Allow** policy listing only your email address. Do not use an Everyone, Bypass, or Service Auth policy for this personal app.

Add **One-time PIN** under the identity-provider/login-method settings and enable it for the application. Current Zero Trust organizations may need to add this explicitly. Access sends codes only to email addresses allowed by policy. See [Cloudflare's OTP setup](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/).

Set these nonsecret values in `wrangler.jsonc`:

- `ACCESS_TEAM_DOMAIN`: your team hostname, such as `your-team.cloudflareaccess.com`, without `https://` or a trailing slash.
- `ACCESS_AUD`: the Application Audience (AUD) Tag from the Access application's settings.

Signal verifies the token signature, issuer, audience, expiry, subject, and email. Missing or invalid configuration fails closed. It does not trust raw email headers. See [Cloudflare token validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

## 4. Apply migrations and deploy

From the repository root:

```sh
npm run types
npm run db:remote
npm run deploy
```

The migration command targets the new D1 database configured above. `npm run deploy` builds first, then Wrangler uses the Vite-generated deployment configuration. No data from another instance should be imported.

Open your custom hostname. Verify that Access asks for your email and PIN. Complete the first-run form with your roles, location preferences, and optional résumé/portfolio text. Résumé text can be pasted or imported from a UTF-8 `.txt` file under 100 KB and 40,000 characters. For PDF or Word files, copy the text into the form. Original files are not stored. Portfolio URLs are not automatically fetched; supply the relevant facts as text.

You can skip résumé evidence and use job search and tracking immediately. Discovery is user-triggered, filters by your chosen roles and locations, and is not exhaustive. Location matching uses feed text; verify work eligibility yourself.

## 5. Enable optional cover letters

In [OpenAI Platform](https://platform.openai.com/), create a dedicated project for this instance. Enable API billing in the account's billing settings before testing generation. Select the new project before creating its key; do not use an organization-admin key.

Start with conservative controls: for example, a $5 monthly spend alert and a $10 monthly hard limit where available, plus low request/token rate limits for the selected model. Confirm the enforcement shown in your account: an alert is a notification, not a spending stop. Current API documentation describes separate project spend alerts, hard limits, and model permissions/rate limits. See [OpenAI project controls](https://developers.openai.com/api/reference/typescript/resources/admin/subresources/organization/subresources/projects).

Create a project-scoped API key with only the access needed to call Responses. Store it directly as the Worker's encrypted secret, using the Cloudflare dashboard or Wrangler's interactive prompt:

```sh
npx wrangler secret put OPENAI_API_KEY
```

Never paste the key into a chat, commit it, put it in `wrangler.jsonc`, or expose it through client-side variables. The app reads it only on the server. See [OpenAI authentication guidance](https://developers.openai.com/api/docs/guides/production-best-practices).

The default `OPENAI_MODEL` is `gpt-5.4-mini`; verify that the project can use it. Change the setting only to a model supporting the request's Responses/structured-output options, and retest. No live API calls are part of the automated suite.

In Preferences, save your name and résumé, review the optional portfolio evidence, and check the consent box. Generating a letter sends this evidence and the selected job listing to OpenAI. Changing the evidence clears the UI's approval checkbox. Letters use only the supplied candidate facts and are saved for later editing and PDF export. Review every generated letter before use.

Without a key, generation is visibly disabled and tracking remains usable. Set `GENERATION_ENABLED` to `false` and redeploy to stop new generations without disabling tracking or saved-letter editing. The app is for a private instance: it has no payment system or application-level credit ledger. Restrict Access membership and monitor usage; concurrent generation requests can incur separate API costs.

## 6. Verify your installation

- In a private browser window, the hostname prompts for Access sign-in. An unapproved email cannot gain entry.
- After signing in, a new profile contains no personal defaults or existing jobs.
- Save preferences, import a job URL, mark it applied, reload, and confirm persistence.
- With no API key, generation is disabled; tracking still works.
- With a key and approved evidence, generate one letter and verify the name and facts. Reopening it must preserve edits rather than generating again.
- Confirm Workers' default and preview URLs are disabled. Requests to APIs without a valid Access token return 401 if they reach the Worker.

## Development and maintenance

`npm run dev` runs locally, but does not bypass authentication. For authenticated UI development, use a separate Access-protected development hostname pointing through a Cloudflare Tunnel to localhost, configured with its own AUD and local D1 data. Use the signed-token integration tests for credential-free verification. Do not add a production auth bypass.

Local migrations: `npm run db:local`. Schema changes: `npm run db:generate`, inspect the migration, and test before applying remotely. Run `npm run types` whenever bindings change.

All profile text, jobs, notes, and letters are stored in your D1 database under the verified Access subject. You control the database and any backups. Replace or clear résumé/portfolio fields through Preferences; existing letters are separate records and remain until edited/cleared. Full account export/deletion UI is not included. The instance owner can export or delete their database through Cloudflare; backup retention follows their Cloudflare settings.

The app sends generation requests with response storage disabled. This does not itself promise zero retention by the API provider; review your account's data settings before uploading sensitive material. No automatic job applications or scheduled crawling are performed.
