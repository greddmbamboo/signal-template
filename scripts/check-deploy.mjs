import { readFile } from 'node:fs/promises';
const config = JSON.parse(await readFile('dist/server/wrangler.json', 'utf8'));
const failures = [];
if (!config.d1_databases?.some(db => db.binding === 'DB' && /^[a-f0-9-]{36}$/i.test(db.database_id) && !db.database_id.startsWith('00000000-'))) failures.push('Create your own D1 database and set its ID.');
if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(config.vars?.ACCESS_TEAM_DOMAIN || '') || !config.vars?.ACCESS_AUD) failures.push('Configure your Access team domain and application AUD.');
if (!config.routes?.some(route => typeof route === 'object' && route.custom_domain && !route.pattern.endsWith('.example.com'))) failures.push('Configure your own Access-protected custom hostname.');
if (config.workers_dev !== false || config.preview_urls !== false) failures.push('Disable workers_dev and preview_urls.');
if (failures.length) throw new Error(`Deployment setup is incomplete:\n${failures.join('\n')}`);
console.log('Deployment configuration is set. Confirm the hostname is protected by your Access Allow policy.');
