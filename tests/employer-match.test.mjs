import test from 'node:test';
import assert from 'node:assert/strict';
import {sameOpening} from '../lib/employer-match.ts';
import {applicationLinks} from '../lib/job-import.ts';
const description='Design thoughtful enterprise workflows through research testing prototyping and close collaboration with product engineering and customers. Build reusable interaction patterns for complex administrative systems while maintaining high quality accessibility and measurable customer outcomes.';
const job={company:'Example Inc.',title:'Senior Product Designer',location:'Remote USA',description};
test('employer match requires company, level, and corroborating requisition or content/location',()=>{
 const employer={...job,company:'Example',location:'Remote United States',verification:'employer'};
 assert.equal(sameOpening(job,employer),true);
 for(const change of [{company:'Other'},{title:'Staff Product Designer'},{location:'London'},{description:'Unrelated opening'},{verification:'unverified'}])assert.equal(sameOpening(job,{...employer,...change}),false);
 assert.equal(sameOpening({...job,requisitionId:'1'},{...employer,requisitionId:'2'}),false);
 assert.equal(sameOpening({...job,requisitionId:'1'},{...employer,requisitionId:'1'}),true);
});
test('application candidates are bounded public HTTPS links and never LinkedIn',()=>{
 const html='<a href="https://jobs.ashbyhq.com/example/1">Apply</a><a href="http://localhost/x">Apply</a><a href="https://www.linkedin.com/jobs/1">Apply</a><a href="https://127.0.0.1/secret">Apply</a><a href="javascript:alert(1)">Apply</a>';
 assert.deepEqual(applicationLinks(html,'https://aggregator.example/jobs/1'),['https://jobs.ashbyhq.com/example/1']);
});

