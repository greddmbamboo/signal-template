import {locationSignal} from './model.ts';

type Listing={company:string;title:string;location:string;description:string;requisitionId?:string;verification?:string};
const words=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const company=(s:string)=>words(s).replace(/\b(incorporated|inc|llc|ltd|limited|corporation|corp)\b/g,'').trim();
const title=(s:string)=>words(s).replace(/\bsr\b/g,'senior').replace(/\bjr\b/g,'junior').replace(/\bremote\b/g,'').replace(/\s+/g,' ').trim();
export function sameOpening(a:Listing,b:Listing){
 if(b.verification!=='employer'||!company(a.company)||company(a.company)!==company(b.company)||title(a.title)!==title(b.title))return false;
 if(a.requisitionId&&b.requisitionId)return a.requisitionId===b.requisitionId;
 const al=locationSignal(a as Parameters<typeof locationSignal>[0]),bl=locationSignal(b as Parameters<typeof locationSignal>[0]);
 const samePlace=words(a.location)===words(b.location)&&!/(unknown|not specified|not listed)/i.test(a.location);
 const employerCorrectsArrangement=!bl.remote&&(/\bhybrid\b|\b(?:at least\s+)?[1-7]\s+days?\s+(?:per|a)\s+week\b[^.!?\n]{0,100}\b(?:office|on[- ]?site|in[- ]office)\b/i.test(b.description||''));
 if(!samePlace&&!(al.remote&&bl.remote&&al.preferred&&bl.preferred)&&!employerCorrectsArrangement)return false;
 // Exact company/title alone can still identify multiple requisitions. Require
 // substantial shared description language before an automatic upgrade.
 const tokens=(s:string)=>words(s).split(' ').filter(Boolean);
 const phrases=(s:string)=>{const w=tokens(s);return new Set(w.slice(0,-4).map((_,i)=>w.slice(i,i+5).join(' ')));};
 const x=phrases(a.description),y=phrases(b.description);let shared=0;for(const p of x)if(y.has(p))shared++;
 return shared>=12&&shared/Math.max(1,Math.min(x.size,y.size))>=0.25;
}
