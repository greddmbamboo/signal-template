import {getSql} from '../db';
import {importJobUrl,fetchHtml,applicationLinks} from './job-import';
import {sameOpening} from './employer-match';
import {searchPage} from './brave-search';
import {readInbox,getProfile} from './store';
import {canonicalJobUrl,inboxDecision,listingCandidate,SEARCH_CACHE_MS} from './search-policy';
import {type Job} from './model';

export const FOLLOWUP_LIMIT=20;
type Imported=Awaited<ReturnType<typeof importJobUrl>>;
type Outcome={employer?:Imported;reason:string;checkedAt:string;searches:number};
export async function followupQueue(owner:string){
 const {jobs,profile}=await readInbox(owner);
 const pending=jobs.filter(j=>j.status==='inbox'&&j.active&&j.source!=='manual'&&j.verification!=='employer'&&inboxDecision(j,profile)!=='excluded'&&(!j.verificationCheckedAt||Date.now()-Date.parse(j.verificationCheckedAt)>=SEARCH_CACHE_MS)).sort((a,b)=>(a.verificationCheckedAt||'').localeCompare(b.verificationCheckedAt||''));
 return {ids:pending.slice(0,FOLLOWUP_LIMIT).map(j=>j.id),deferred:Math.max(0,pending.length-FOLLOWUP_LIMIT)};
}
async function cacheKey(job:Job){const data=JSON.stringify([job.url,job.company,job.title,job.location,job.description]);return 'employer:v1:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function followEmployer(job:Job,apiKey:string):Promise<Outcome>{
 const matches=new Map<string,Imported>(),seen=new Set<string>();let blocked=0,searches=0;
 const check=async(url:string)=>{const canonical=canonicalJobUrl(url);if(seen.has(canonical)||/https:\/\/(?:[^/]+\.)?linkedin\.com\//i.test(canonical))return;seen.add(canonical);try{const candidate=await importJobUrl(url,true);if(sameOpening(job,candidate))matches.set(canonicalJobUrl(candidate.url),candidate);}catch{blocked++;}};
 let links=job.applicationUrls||[];
 try{
  const original=await importJobUrl(job.url,true);
  if(sameOpening(job,original))return {employer:original,reason:'Confirmed this discovery URL is the matching employer listing.',checkedAt:new Date().toISOString(),searches};
  links=[...new Set([...links,...(original.applicationUrls||[])])].slice(0,3);
 }catch{try{const page=await fetchHtml(job.url,false);links=[...new Set([...links,...applicationLinks(page.html,page.url.toString())])].slice(0,3);}catch{blocked++;}}
 for(const url of links)await check(url);
 if(matches.size===1)return {employer:[...matches.values()][0],reason:'Matched the employer listing through an application link.',checkedAt:new Date().toISOString(),searches};
 if(matches.size>1)return {reason:'Multiple employer openings match; the correct requisition is unclear.',checkedAt:new Date().toISOString(),searches};
 if(!apiKey)return {reason:'No matching application link; Brave is not connected for the follow-up search.',checkedAt:new Date().toISOString(),searches};
 const quote=(s:string)=>'"'+s.replace(/["\r\n]/g,' ').slice(0,160)+'"';
 const query=`${quote(job.company)} ${quote(job.title)} ${job.location.replace(/["\r\n]/g,' ').slice(0,100)} (careers OR jobs OR apply) -site:linkedin.com`;
 try{
  const result=await searchPage(apiKey,query,0);searches=result.cached?0:1;
  const rows=(result.data.web?.results||[]).filter(r=>typeof r.url==='string'&&typeof r.title==='string'&&listingCandidate(r.url,r.title));
  for(const row of rows.slice(0,3))await check(row.url);
 }catch(error){return {reason:error instanceof Error?error.message:'Employer follow-up search unavailable.',checkedAt:new Date().toISOString(),searches};}
 return {employer:matches.size===1?[...matches.values()][0]:undefined,reason:matches.size>1?'Multiple employer openings match; the correct requisition is unclear.':matches.size===1?'Matched company, role and requisition or location/description on the employer listing.':blocked?'Could not confirm the same opening; some pages were blocked, unavailable, or lacked job data.':'No sufficiently close employer match found. This does not mean the job is closed.',checkedAt:new Date().toISOString(),searches};
}
export async function verifyStoredJob(owner:string,id:string,apiKey:string){
 const db=getSql();const row=await db.prepare('SELECT payload,status,active,last_seen FROM jobs WHERE owner=? AND id=?').bind(owner,id).first<{payload:string;status:string;active:number;last_seen:string}>();
 if(!row)throw new Error('Listing not found.');
 const payload=JSON.parse(row.payload);const job={...payload,id,status:row.status,active:row.active,lastSeen:row.last_seen} as Job;
 if(job.status!=='inbox'||!job.active||job.source==='manual'||job.verification==='employer'||inboxDecision(job,await getProfile(owner))==='excluded')return {id,skipped:true};
 const key=await cacheKey(job),now=Date.now();const cache=await db.prepare('SELECT payload,expires FROM search_cache WHERE key=?').bind(key).first<{payload:string|null;expires:number}>();
 let outcome:Outcome,cached=false;
 if(cache&&cache.expires>now&&cache.payload){outcome=JSON.parse(cache.payload);cached=true;}
 else{
  const claimed=await db.prepare('INSERT INTO search_cache (key,payload,expires) VALUES (?,NULL,?) ON CONFLICT(key) DO UPDATE SET payload=NULL,expires=excluded.expires WHERE search_cache.expires<=? RETURNING key').bind(key,now+240000,now).first();
  if(!claimed)return {id,skipped:true,reason:'Employer check already running.'};
  try{outcome=await followEmployer(job,apiKey);await db.prepare('UPDATE search_cache SET payload=?,expires=? WHERE key=?').bind(JSON.stringify(outcome),Date.now()+SEARCH_CACHE_MS,key).run();}
  catch(error){await db.prepare('DELETE FROM search_cache WHERE key=? AND payload IS NULL').bind(key).run();throw error;}
 }
 const update={...payload,...(outcome.employer||{}),source:job.source,origin:job.origin,discoveryUrl:job.discoveryUrl||job.url,verificationCheckedAt:outcome.checkedAt,verificationReason:outcome.reason,...(outcome.employer?{url:canonicalJobUrl(outcome.employer.url),verifiedAt:outcome.checkedAt}:{} )};
 // Update only imported facts; statuses, notes, letters and record IDs stay untouched.
 // Compare-and-swap avoids overwriting a concurrent import/edit of those facts.
 await db.prepare('UPDATE jobs SET payload=?,last_seen=CASE WHEN ? THEN ? ELSE last_seen END WHERE owner=? AND id=? AND payload=?').bind(JSON.stringify(update),outcome.employer?1:0,outcome.checkedAt,owner,id,row.payload).run();
 return {id,company:job.company,title:job.title,verified:Boolean(outcome.employer),reason:outcome.reason,cached,searches:cached?0:outcome.searches};
}

