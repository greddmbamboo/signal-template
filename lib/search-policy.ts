import {type Profile,type Job,matchesTargetRole,locationSignal,matchesLocationPreference} from './model.ts';

export const SEARCH_MONTHLY_LIMIT=900;
export const SEARCH_CACHE_MS=24*60*60*1000;
export function searchPlan(profile:Profile){
 const roles=[...new Set(profile.roles.split(',').map(s=>s.replace(/["\n]/g,' ').trim()).filter(Boolean))].slice(0,6);
 const places=profile.location==='preferred'?(profile.preferredLocations||'').split(',').map(s=>s.replace(/["\n]/g,' ').trim()).filter(Boolean).slice(0,2):profile.location==='remote'?['remote']:[''];
 if(!places.length)places.push('');
 // Role and geography only: no employer allowlist. Both result pages are bounded.
 return ['ats','web'].flatMap(scope=>roles.flatMap(role=>places.map(place=>({q:`"${role}" ${place} -site:linkedin.com ${scope==='web'?'(careers OR hiring OR apply) -intitle:jobs -intitle:salary -intitle:salaries':'(site:job-boards.greenhouse.io OR site:jobs.ashbyhq.com OR site:jobs.lever.co OR site:jobs.smartrecruiters.com)'}`.trim(),page:0}))));
}
export function listingCandidate(url:string,title:string){
 try{const u=new URL(url);return u.protocol==='https:'&&!/(?:^|\.)linkedin\.com$/i.test(u.hostname)&&!/(?:\/salaries?\/|\/agencies\/|\/hire\/|\/search\/|\/role\/|\/roles\/)/i.test(u.pathname)&&!/(?:\bsalar(?:y|ies)\b|\b(?:best|top)\s+\d*\s*(?:companies|agencies)|\bjobs\s+(?:in|near)\b)/i.test(title);}catch{return false;}
}
export function canonicalJobUrl(input:string){
 try{const u=new URL(input);u.hash='';for(const key of [...u.searchParams.keys()])if(/^utm_|^(trk|trackingId|ref|source|gh_src)$/i.test(key))u.searchParams.delete(key);u.hostname=u.hostname.replace(/^boards\.greenhouse\.io$/,'job-boards.greenhouse.io');u.pathname=u.pathname.replace(/\/$/,'');u.searchParams.sort();return u.toString();}catch{return input;}
}
export function inboxDecision(job:Job,profile:Profile):'match'|'review'|'excluded'{
 if(job.source==='manual')return 'match';
 if(!matchesTargetRole(job.title,profile.roles))return 'excluded';
 const loc=locationSignal(job);
 if(profile.location!=='all'&&!matchesLocationPreference(job,profile)){
  if(/not (?:listed|specified)|unknown|eligibility not specified/i.test(job.location)||loc.possible)return 'review';
  return 'excluded';
 }
 if(profile.minSalary>0&&job.salaryMax&&job.salaryMax<profile.minSalary)return 'excluded';
 if(job.verification!=='employer'||Date.now()-new Date(job.lastSeen).getTime()>7*86400000)return 'review';
 return 'match';
}
