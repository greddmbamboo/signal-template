import {normalizeJob,type Source} from './model';
export async function fetchSource(s:Source){
 const endpoint=s.provider==='greenhouse'?`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(s.token)}/jobs?content=true`:s.provider==='ashby'?`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(s.token)}`:`https://api.lever.co/v0/postings/${encodeURIComponent(s.token)}?mode=json`;
 const response=await fetch(endpoint,{signal:AbortSignal.timeout(20000),redirect:'manual',headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error(`Source returned HTTP ${response.status}. Existing listings were kept.`);
 if(Number(response.headers.get('content-length')||0)>20000000)throw new Error('This feed is too large to process.');
 const data:any=await response.json();const raw=s.provider==='greenhouse'||s.provider==='ashby'?data.jobs:data;
 if(!Array.isArray(raw)||raw.some((j:any)=>!j||j.id===undefined||typeof(s.provider==='lever'?j.text:j.title)!=='string'))throw new Error('Unexpected feed format. Existing listings were kept.');
 const now=new Date().toISOString();
 return raw.map((j:any)=>normalizeJob(j,s,now)).filter(j=>j.url);
}
