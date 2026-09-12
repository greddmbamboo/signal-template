# Brave discovery

Set BRAVE_SEARCH_API_KEY as a server-side Cloudflare Worker secret. Never put it in the browser, source, or a NEXT_PUBLIC variable. Use a dedicated Search API account/key and confirm its current free-credit conditions and provider-side spending controls. This app cannot see usage by other apps sharing the account.

This implementation reserves at most 900 requests per UTC calendar month for the entire installation, including failed calls. No paid override is enabled. Up to six configured roles, two location queries and two query styles (open web and cross-employer ATS search) produce at most 24 requests per refresh. Duplicate queries reuse a 24-hour cache. Cached searches and the original free feeds remain available when the allowance is exhausted. No OpenAI calls are made during discovery.

Keep the tab open during a search. Queries run in bounded steps; each checks six result pages at a time and continues through up to 20 results per query without buying another search. Reports explicitly list failures and deferred pages. A stopped/failed run is partial; it does not imply complete web coverage. The last query reports survive reopening the app. Query text includes roles/location only, not resumes or other personal evidence.

Supported imports: Dayforce embedded job data, Greenhouse and SmartRecruiters APIs, or pages providing structured JobPosting data (including employer domains, Ashby and Lever where available). Generic HTML/career homepages are not converted to fake job listings. Missing structured data is reported for manual review. No LinkedIn requests are made by Brave discovery.

Employer follow-up runs after discovery and free feeds for up to 20 active, relevant, non-manual inbox records per refresh. It checks the discovery URL and up to three application links, then uses at most one additional company/title/location Brave query and checks up to three results. Those searches share the 900-request allowance and existing query cache. Verified and unsuccessful follow-ups are cached for 24 hours; remaining records can be checked on a later refresh. The tab must remain open.

Automatic matching requires an employer-verified destination, normalized company and title agreement (including seniority), and either a matching requisition ID or compatible location plus substantial shared description phrases. Multiple matching requisitions remain unverified. A missing or blocked match never marks a job closed. Successful checks update the original record's imported facts and primary URL while preserving its ID, status, notes and cover letter; the discovery URL is retained. Later aggregator refreshes cannot downgrade an employer-verified record. Per-job follow-up reasons are shown on unverified cards and in job details.

Flagged is retired. Existing flagged records return to inbox status with notes and cover letters retained; regular eligibility rules determine whether they appear in Inbox or Needs review.

Employer-page verification is based on a successful ATS request or structured JobPosting data on the hiring organization's stated domain. It is not proof of hiring intent or security vetting. Search snippets are never treated as verified job descriptions. Cross-site duplicates only merge when a canonical job URL matches; distinct requisitions remain separate. Different aggregator URLs without a proven canonical link may remain duplicates.

Jobs absent from later bounded searches/feeds remain tracked. Old observations move to Needs review after seven days; explicit expired structured listings are rejected on import. There is no automatic closure check for every historical job yet.


## Optional setup

Create your own Brave Search API account at https://api-dashboard.search.brave.com/ and choose a Search plan. Check the provider's current pricing and account limits; the app's 900-request cap does not guarantee free usage. Set BRAVE_SEARCH_API_KEY using your deployment's server-side secret workflow (for example, Wrangler's interactive secret prompt). Never paste the key into chat, commit it, or use a public client variable. Without a Brave key, free feeds and manual imports still work.

The 900-request limit is an application spending safeguard shared by all users of one installation, not a measure of purchased credits. OpenAI cover-letter credits and Brave search usage are separate. Queries use your configured roles and up to two preferred locations, never a preset company list. English search is currently used; geographic matching remains approximate, so review eligibility.
