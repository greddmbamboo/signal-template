import test from 'node:test';
import assert from 'node:assert/strict';
import {stateEligibility} from '../lib/state-eligibility.ts';
import {defaultProfile,locationSignal,matchesLocationPreference} from '../lib/model.ts';
import {inboxDecision} from '../lib/search-policy.ts';

const profile={...defaultProfile,roles:'Product Designer',location:'preferred',preferredLocations:'Colorado, United States'};
const job={id:'eligibility-test',source:'brave',company:'Example',title:'Staff Product Designer',location:'Remote · United States',url:'https://example.com/jobs/1',description:'',department:'Design',salary:'Not listed',status:'inbox',reason:'',coverLetter:'',firstSeen:new Date().toISOString(),lastSeen:new Date().toISOString(),active:1,verification:'employer'};

test('explicit state restrictions use the installer selected state',()=>{
 assert.equal(stateEligibility({...job,description:'Candidates must reside in California, Colorado, or New York.'},'CO').status,'eligible');
 const excluded={...job,description:'We can only hire candidates in California and New York.'};
 assert.equal(stateEligibility(excluded,'CO').status,'excluded');
 assert.equal(inboxDecision(excluded,profile),'excluded');
 assert.equal(matchesLocationPreference(excluded,profile),false);
});

test('vague or conflicting state language stays in review',()=>{
 for(const description of ['Remote employment is limited to certain states.','Eligible states: CA, CO. We cannot hire residents in CO.'])assert.equal(inboxDecision({...job,description},profile),'review');
});

test('state-only remote locations are authoritative',()=>{
 assert.equal(locationSignal({...job,location:'Remote - CA, NY'},profile).state.status,'excluded');
 assert.equal(locationSignal({...job,location:'Remote - CO, UT'},profile).state.status,'eligible');
});
