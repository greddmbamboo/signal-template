import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProfile,dedupeJobs} from '../lib/model.ts';
import {searchPlan,inboxDecision} from '../lib/search-policy.ts';
const job={id:'one',source:'feed',company:'Example',title:'Software Engineer',location:'Remote Canada',url:'https://example.com/job/1',description:'',status:'inbox',reason:'',coverLetter:'',firstSeen:new Date().toISOString(),lastSeen:new Date().toISOString(),active:1,verification:'employer'};
test('search uses installer roles and geography with no company or private defaults',()=>{
 const plan=searchPlan({...defaultProfile,roles:'Software Engineer',location:'preferred',preferredLocations:'Berlin, Canada'});
 assert.equal(plan.length,4);
 assert.ok(plan.every(p=>p.q.includes('Software Engineer')&&(p.q.includes('Berlin')||p.q.includes('Canada'))));
 assert.ok(plan.every(p=>!p.q.includes('Utah')&&!p.q.includes('Product Designer')));
 assert.equal(searchPlan(defaultProfile).length,0);
});
test('clear mismatches excluded, unknown evidence reviewed, manual jobs preserved',()=>{
 const p={...defaultProfile,roles:'Software Engineer',location:'remote'};
 assert.equal(inboxDecision(job,p),'match');
 assert.equal(inboxDecision({...job,location:'Hybrid London'},p),'excluded');
 assert.equal(inboxDecision({...job,location:'Not specified'},p),'review');
 assert.equal(inboxDecision({...job,verification:'unverified'},p),'review');
 assert.equal(inboxDecision({...job,title:'Accountant'},p),'excluded');
 assert.equal(inboxDecision({...job,title:'Accountant',source:'manual'},p),'match');
});
test('distinct requisitions stay separate; canonical duplicates preserve rejection and draft',()=>{
 assert.equal(dedupeJobs([job,{...job,id:'two',url:'https://example.com/job/2'}]).length,2);
 const [merged]=dedupeJobs([job,{...job,id:'two',url:job.url+'?utm_source=x',status:'rejected',coverLetter:'Saved draft'}]);
 assert.equal(merged.status,'rejected');assert.equal(merged.coverLetter,'Saved draft');
 assert.deepEqual(merged.duplicateIds,['one','two']);
});

