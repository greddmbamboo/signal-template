import {env} from 'cloudflare:workers';
export function getSql(){if(!env.DB)throw new Error('The inbox database is unavailable.');return env.DB;}
