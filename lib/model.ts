export type Source = {id:string; company:string; provider:'greenhouse'|'lever'|'ashby'|'linkedin'|'jobicy'|'remoteok'|'arbeitnow'; token:string; careers?:string; checkedAt?:string; count?:number; error?:string};
export type Profile = {roles:string; skills:string; resume:string; location:'preferred'|'all'|'remote'; minSalary:number; minQuality:number; name?:string; preferredLocations?:string; portfolio?:string; evidenceApproved?:boolean; onboardingComplete?:boolean};
export type Job = {id:string; source:string; company:string; title:string; location:string; url:string; linkedinUrl?:string; linkedinId?:string; origin?:'manual'|'linkedin'|'discovery'; description:string; department:string; salary:string; salaryMin?:number; salaryMax?:number; updatedAt?:string; postedAt?:string; prospect?:boolean; status:string; reason:string; coverLetter:string; firstSeen:string; lastSeen:string; active:number};
export const defaultProfile:Profile={roles:'',skills:'',resume:'',location:'all',minSalary:0,minQuality:65,name:'',preferredLocations:'',portfolio:'',evidenceApproved:false,onboardingComplete:false};
export const defaultSources:Source[]=[
 {id:'jobicy:discovery',company:'Jobicy market search',provider:'jobicy',token:'',careers:'https://jobicy.com/'},
 {id:'remoteok:discovery',company:'Remote OK market search',provider:'remoteok',token:'',careers:'https://remoteok.com/'},
 {id:'arbeitnow:discovery',company:'Arbeitnow market search',provider:'arbeitnow',token:'',careers:'https://www.arbeitnow.com/'}
];
export function isDesignRole(title:string){return /(?:ux|user experience)\s+(?:manager|director|lead)|(?:product|ux|user experience|interaction)\s+design(?:er)?|design\s+(?:manager|director|lead)|(?:head|director|manager|vp|vice president)\s+(?:of[, ]+)?(?:product\s+|ux\s+)?design/i.test(title)&&!/(?:software|engineer|recruiter|people partner|product manager|program manager|marketing|brand)/i.test(title)}
function designLeadership(title:string){return /\b(?:manager|director|head|lead|vp|vice president)\b/i.test(title)&&/\b(?:design|ux|user experience)\b/i.test(title)}
function designIndividualContributor(title:string){return /\b(?:product|ux|user experience|interaction)\s+design(?:er)?\b/i.test(title)&&!designLeadership(title)}
export function matchesTargetRole(title:string,rolesText:string){const normalized=title.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();const roles=rolesText.split(',').map(r=>r.trim()).filter(Boolean);return roles.some(role=>{const target=role.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();return normalized.includes(target)||(designLeadership(title)&&designLeadership(role))||(designIndividualContributor(title)&&designIndividualContributor(role));});}
export function plainText(html:string){let s=String(html||'');for(let i=0;i<2;i++)s=s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&mdash;/g,'—').replace(/&ndash;/g,'–').replace(/&rsquo;|&lsquo;/g,"'").replace(/&ldquo;|&rdquo;/g,'"');return s.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<\/(p|li|h\d|div)>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n\n').trim()}
export function salaryFrom(text:string){
 const regex=/(?:US\s*|USD\s*)?\$\s?([\d,]+(?:\.\d+)?)(k)?\s*(?:-|–|—|to)\s*\$?\s?([\d,]+(?:\.\d+)?)(k)?/gi;
 const ranges:{min:number;max:number;currency:string}[]=[];
 for(const m of text.matchAll(regex)){
  const min=Number(m[1].replace(/,/g,''))*(m[2]?1000:1),max=Number(m[3].replace(/,/g,''))*(m[4]?1000:1);
  if(min<20000||max>1000000||max<min)continue;
  const index=m.index||0;const context=text.slice(Math.max(text.lastIndexOf('\n',index)+1,index-100),Math.min(text.indexOf('\n',index+m[0].length)<0?text.length:text.indexOf('\n',index+m[0].length),index+m[0].length+40));
  const currency=/\bCAD\b|canadian/i.test(context)?'CAD':/\bUSD\b|\bUSA?\b|U\.S\./i.test(context)?'USD':'unknown';ranges.push({min,max,currency});
 }
 if(!ranges.length)return {salary:'Not listed'};
 const usd=ranges.filter(r=>r.currency==='USD');
 const normalized=usd.length?{salaryMin:Math.min(...usd.map(r=>r.min)),salaryMax:Math.max(...usd.map(r=>r.max))}:{};
 if(ranges.length>1)return {salary:'Multiple pay bands · see posting',...normalized};
 const r=ranges[0];return {salary:`$${Math.round(r.min/1000)}k–$${Math.round(r.max/1000)}k ${r.currency==='unknown'?'· currency unconfirmed':r.currency}`, ...normalized};
}
export function locationSignal(job:Job){const remote=/\bremote\b|telecommut|work from home/i.test(job.location);return {remote,possible:remote,label:remote?'Remote · check eligibility':'Check work arrangement'};}
export function matchesLocationPreference(job:Job,profile:Profile){
 const loc=locationSignal(job);
 if(profile.location==='all')return true;
 if(profile.location==='remote')return loc.remote;
 const locations=(profile.preferredLocations||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
 return locations.some(value=>job.location.toLowerCase().includes(value));
}
export function officialListingProvider(job:Pick<Job,'url'|'origin'>){
 try{const host=new URL(job.url).hostname.toLowerCase();if(host==='boards.greenhouse.io'||host==='job-boards.greenhouse.io')return 'Greenhouse';if(host==='jobs.lever.co')return 'Lever';if(host==='jobs.ashbyhq.com')return 'Ashby';if(host==='jobs.smartrecruiters.com')return 'SmartRecruiters';}catch{}
 if(!job.origin)return 'Employer ATS feed';
 return '';
}
export function scoreJob(j:Job,p:Profile,now=Date.now()){
 const qualitySignals:{label:string;points:number}[]=[];const warnings:string[]=[];
 const age=(now-new Date(j.lastSeen).getTime())/86400000;
 const officialProvider=officialListingProvider(j);const official=Boolean(officialProvider)&&Boolean(j.active);const discovered=(j.origin==='linkedin'||j.origin==='discovery')&&!officialProvider;
 qualitySignals.push({label:official?(j.origin?`Verified on ${officialProvider}`:'Present in employer ATS feed'):discovered?`${j.origin==='linkedin'?'LinkedIn':'Market'} discovery — employer listing not yet verified`:'Manually added — source not yet verified',points:official?50:discovered&&j.active?35:20});
 if(discovered)warnings.push('Discovery source; verify it on the employer’s careers site');else if(!official)warnings.push('Manually added listing; verify it on the employer’s careers site');
 if(j.active&&age<=2)qualitySignals.push({label:'Feed checked within 48 hours',points:15});else warnings.push('Needs a fresh source check');
 if(j.description.length>1000)qualitySignals.push({label:'Substantial job description',points:15});else warnings.push('Limited description');
 if(j.salary!=='Not listed')qualitySignals.push({label:'Compensation information found',points:10});else warnings.push('Salary not detected');
 if(j.department)qualitySignals.push({label:'Department is named',points:10});
 if(j.prospect){qualitySignals.push({label:'General interest / prospect posting',points:-30});warnings.push('May be a talent pool rather than an open role');}
 if((now-new Date(j.firstSeen).getTime())/86400000>90){qualitySignals.push({label:'Observed for more than 90 days',points:-10});warnings.push('Long-running listing; hiring intent is unknown');}
 const loc=locationSignal(j);let fit=0;const fitSignals:{label:string;points:number}[]=[];
 const matches=matchesTargetRole(j.title,p.roles);fitSignals.push({label:matches?'Matches a target role family':'Does not match target roles',points:matches?40:0});
 const locationMatch=matchesLocationPreference(j,p);
 fitSignals.push({label:p.location==='all'?'Location unrestricted':locationMatch?'Matches chosen location preference':loc.possible?'Remote; eligibility unclear':'Location needs review',points:locationMatch?25:loc.possible?10:0});
 const skills=p.skills.split(',').map(s=>s.trim()).filter(Boolean);const matched=skills.filter(s=>j.description.toLowerCase().includes(s.toLowerCase()));
 const skillPoints=skills.length?Math.round(25*matched.length/skills.length):0;
 fitSignals.push({label:matched.length?`Description mentions: ${matched.join(', ')}`:'No chosen skill phrases detected',points:skillPoints});
 fitSignals.push({label:p.minSalary===0?'No salary floor set':j.salaryMax&&j.salaryMax>=p.minSalary?'Listed range may meet salary floor':'Salary floor needs confirmation',points:p.minSalary===0?10:j.salaryMax&&j.salaryMax>=p.minSalary?10:0});
 fit=fitSignals.reduce((n,s)=>n+s.points,0);
 return {quality:Math.max(0,Math.min(100,qualitySignals.reduce((n,s)=>n+s.points,0))),fit,qualitySignals,fitSignals,warnings,loc};
}
export function normalizeJob(raw:any,s:Source,now:string):Job {
 const gh=s.provider==='greenhouse',ashby=s.provider==='ashby';
 const description=plainText(gh?raw.content:ashby?raw.descriptionPlain:[raw.descriptionPlain,...(raw.lists||[]).map((l:any)=>`${l.text}\n${l.content}`),raw.additionalPlain,raw.salaryDescriptionPlain].filter(Boolean).join('\n\n'));
 const comp=!gh&&!ashby&&raw.salaryRange?.currency==='USD'&&raw.salaryRange?.interval==='per-year'?{salary:`$${Math.round(raw.salaryRange.min/1000)}k–$${Math.round(raw.salaryRange.max/1000)}k USD / year`,salaryMin:raw.salaryRange.min,salaryMax:raw.salaryRange.max}:salaryFrom([description,ashby?raw.compensationTierSummary:''].filter(Boolean).join('\n'));
 const url=gh?raw.absolute_url:ashby?raw.jobUrl:raw.hostedUrl;
 const title=gh||ashby?raw.title:raw.text;
 const location=gh?raw.location?.name||'Not listed':ashby?[raw.location,raw.isRemote?'Remote':''].filter(Boolean).join(' · ')||'Not listed':[raw.categories?.location,raw.workplaceType==='remote'?'Remote':raw.workplaceType==='hybrid'?'Hybrid':''].filter(Boolean).join(' · ')||'Not listed';
 return {id:`${s.id}:${raw.id}`,source:s.id,company:s.company,title,location,url:typeof url==='string'&&url.startsWith('https://')?url:'',description:description.slice(0,45000),department:gh?(raw.departments||[]).map((d:any)=>d.name).join(', '):ashby?[raw.department,raw.team].filter(Boolean).join(', '):raw.categories?.team||'',...comp,updatedAt:gh?raw.updated_at:undefined,postedAt:ashby&&raw.publishedAt?new Date(raw.publishedAt).toISOString():!gh&&raw.createdAt?new Date(raw.createdAt).toISOString():undefined,prospect:gh&&raw.internal_job_id===null,status:'inbox',reason:'',coverLetter:'',firstSeen:now,lastSeen:now,active:1};
}
export function sourceFromUrl(company:string,input:string):Source{
 const u=new URL(input);if(u.protocol!=='https:')throw new Error('Use an HTTPS board URL.');
 const paths=u.pathname.split('/').filter(Boolean);const token=paths[0];
 if(!token||! /^[a-zA-Z0-9_-]{1,90}$/.test(token))throw new Error('The company board name is missing or invalid.');
 const provider=['boards.greenhouse.io','job-boards.greenhouse.io'].includes(u.hostname)?'greenhouse':u.hostname==='jobs.lever.co'?'lever':u.hostname==='jobs.ashbyhq.com'?'ashby':null;
 if(!provider)throw new Error('Use a Greenhouse, Lever, or Ashby company board URL.');
 return {id:`${provider}:${token}`,company:company.trim(),provider,token};
}

function dedupeKey(job:Job){const clean=(value:string)=>value.toLowerCase().replace(/&amp;/g,'and').replace(/\b(inc|llc|ltd|company|co)\b/g,'').replace(/[^a-z0-9]/g,'');return `${clean(job.company)}:${clean(job.title)}`;}
export function dedupeJobs(jobs:Job[]){const groups=new Map<string,Job[]>();for(const job of jobs){const key=dedupeKey(job);groups.set(key,[...(groups.get(key)||[]),job]);}return [...groups.values()].map(group=>{if(group.length===1)return group[0];const ranked=[...group].sort((a,b)=>Number(Boolean(officialListingProvider(b)))-Number(Boolean(officialListingProvider(a)))||Number(b.origin==='manual')-Number(a.origin==='manual')||b.description.length-a.description.length);const chosen={...ranked[0]};const statusPriority:Record<string,number>={inbox:0,passed:1,flagged:2,applied:3};const progressed=[...group].sort((a,b)=>(statusPriority[b.status]||0)-(statusPriority[a.status]||0))[0];chosen.status=progressed.status;chosen.reason=progressed.reason;chosen.coverLetter=group.find(job=>job.coverLetter)?.coverLetter||chosen.coverLetter;chosen.linkedinUrl=group.find(job=>job.linkedinUrl)?.linkedinUrl||chosen.linkedinUrl;chosen.linkedinId=group.find(job=>job.linkedinId)?.linkedinId||chosen.linkedinId;chosen.firstSeen=group.map(job=>job.firstSeen).sort()[0];chosen.lastSeen=group.map(job=>job.lastSeen).sort().at(-1)!;chosen.active=group.some(job=>job.active)?1:0;return chosen;});}
