import {getSql} from '../db';
import {boundedText} from './bounded-response';
import {importJobUrl} from './job-import';
import {canonicalJobUrl,inboxDecision,listingCandidate,SEARCH_CACHE_MS,SEARCH_MONTHLY_LIMIT,searchPlan} from './search-policy';
import {type Job,type Profile,matchesTargetRole} from './model';
import {saveFeed} from './store';

export const braveSource={id:'brave:discovery',company:'Brave web search',provider:'brave' as const,token:'',careers:'https://search.brave.com/'};
type Result={url:string;title:string;description?:string};
type SearchData={web?:{results?:Result[]};query?:{more_results_available?:boolean}};
export type SearchReport={query:string;page:number;cached:boolean;returned:number;checked:number;saved:number;review:number;excluded:number;deferred:number;issues:{url:string;reason:string}[];remaining:number};
export async function searchUsage(){
 const month=new Date().toISOString().slice(0,7);const row=await getSql().prepare('SELECT used FROM search_usage WHERE month = ?').bind(month).first<{used:number}>();
 return {used:row?.used||0,limit:SEARCH_MONTHLY_LIMIT,remaining:Math.max(0,SEARCH_MONTHLY_LIMIT-(row?.used||0)),month};
}
async function digest(text:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export async function searchPage(apiKey:string,q:string,page:number):Promise<{data:SearchData;cached:boolean}>{
 const db=getSql(),now=Date.now(),key=await digest(q+':'+page);
 const cached=await db.prepare('SELECT payload,expires FROM search_cache WHERE key = ?').bind(key).first<{payload:string|null;expires:number}>();
 if(cached&&cached.expires>now){if(cached.payload)return {data:JSON.parse(cached.payload),cached:true};throw new Error('This query is already running. Try again shortly.');}
 // Atomic query lease prevents double-clicks/two tabs issuing the same paid request.
 const claim=await db.prepare('INSERT INTO search_cache (key,payload,expires) VALUES (?,NULL,?) ON CONFLICT(key) DO UPDATE SET payload=NULL,expires=excluded.expires WHERE search_cache.expires <= ? RETURNING key').bind(key,now+60000,now).first();
 if(!claim)throw new Error('This query is already running. Try again shortly.');
 try{
  const month=new Date().toISOString().slice(0,7);
  // Reserve BEFORE the external call; failed/time-out requests also consume our conservative allowance.
  const reserved=await db.prepare('INSERT INTO search_usage (month,used) VALUES (?,1) ON CONFLICT(month) DO UPDATE SET used=used+1 WHERE used < ? RETURNING used').bind(month,SEARCH_MONTHLY_LIMIT).first();
  if(!reserved)throw new Error('Monthly search allowance reached. Free feeds and manual tracking still work.');
  const url=new URL('https://api.search.brave.com/res/v1/web/search');url.search=new URLSearchParams({q,count:'20',offset:String(page),search_lang:'en',spellcheck:'false',extra_snippets:'false'}).toString();
  const response=await fetch(url,{headers:{Accept:'application/json','X-Subscription-Token':apiKey},signal:AbortSignal.timeout(20000),redirect:'manual'});
  if(!response.ok){await response.body?.cancel();throw new Error(response.status===401||response.status===403?'Brave rejected the API key or Search plan. Check its setup.':response.status===429?'Brave rate or account limit reached. No automatic retries.':`Brave returned HTTP ${response.status}.`);}
  const data:SearchData=JSON.parse(await boundedText(response,2000000));
  if(data.web?.results&&!Array.isArray(data.web.results))throw new Error('Brave returned an unexpected response.');
  await db.prepare('UPDATE search_cache SET payload=?,expires=? WHERE key=?').bind(JSON.stringify(data),now+SEARCH_CACHE_MS,key).run();
  return {data,cached:false};
 }catch(error){await db.prepare('DELETE FROM search_cache WHERE key=? AND payload IS NULL').bind(key).run();throw error;}
}
export async function runSearchStep(owner:string,profile:Profile,index:number,apiKey:string,batch=0){
 const plan=searchPlan(profile),task=plan[index];if(!task)throw new Error('Invalid search step.');
 const {data,cached}=await searchPage(apiKey,task.q,task.page);
 const rows=data.web?.results||[];
 const candidates=[...new Map(rows.filter(r=>typeof r.url==='string'&&typeof r.title==='string'&&listingCandidate(r.url,r.title)&&matchesTargetRole(r.title,profile.roles)).map(r=>[canonicalJobUrl(r.url),r])).values()];
 const report:SearchReport={query:task.q,page:task.page,cached,returned:batch===0?rows.length:0,checked:0,saved:0,review:0,excluded:batch===0?rows.length-candidates.length:0,deferred:Math.max(0,candidates.length-(batch+1)*6),issues:[],remaining:0};
 const found:Job[]=[];
 // Bounded page retrieval protects Worker limits; deferred candidates are explicitly reported.
 for(const result of candidates.slice(batch*6,(batch+1)*6)){
  report.checked++;
  try{
   const imported=await importJobUrl(result.url,true);
   const url=canonicalJobUrl(imported.url),now=new Date().toISOString();
   const job:Job={...imported,url,id:'web:'+await digest(url),source:braveSource.id,origin:'discovery',status:'inbox',reason:'',coverLetter:'',firstSeen:now,lastSeen:now,active:1,verifiedAt:imported.verification==='employer'?now:undefined};
   if(!matchesTargetRole(job.title,profile.roles)||/training environment|demo company/i.test(job.company)){report.excluded++;continue;}
   const decision=inboxDecision(job,profile);if(decision==='excluded')report.excluded++;else if(decision==='review')report.review++;else report.saved++;
   // Keep excluded records too: changing preferences can make them relevant later.
   found.push(job);
  }catch(error){report.issues.push({url:result.url,reason:error instanceof Error?error.message:'Could not verify listing.'});}
 }
 const db=getSql();
 await db.prepare('INSERT INTO sources (owner,id,payload) VALUES (?,?,?) ON CONFLICT DO NOTHING').bind(owner,braveSource.id,JSON.stringify(braveSource)).run();
 await saveFeed(owner,braveSource,found);
 report.remaining=(await searchUsage()).remaining;
 const historyKey='report:'+owner;
 if(index===0&&batch===0)await db.prepare('DELETE FROM search_cache WHERE key=?').bind(historyKey).run();
 await db.prepare("INSERT INTO search_cache (key,payload,expires) VALUES (?,'[]',?) ON CONFLICT DO NOTHING").bind(historyKey,Date.now()+30*86400000).run();
 await db.prepare("UPDATE search_cache SET payload=json_insert(payload,'$[#]',json(?)) WHERE key=?").bind(JSON.stringify(report),historyKey).run();
 return {report,total:plan.length,next:index+1<plan.length?index+1:null,nextBatch:(batch+1)*6<candidates.length&&batch<3?batch+1:null};
}
