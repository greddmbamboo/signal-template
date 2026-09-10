import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {generateKeyPair, exportJWK, SignJWT} from 'jose';
import {Miniflare} from 'miniflare';

async function modulesAt(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())files.push(...await modulesAt(path));else if(path.endsWith('.js'))files.push(path);}return files;}

test('built app: qualified discovery, tracking preservation, canonical imports, and user isolation',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256');
 const jwk={...await exportJWK(publicKey),kid:'test-key',alg:'RS256',use:'sig'};
 const token=async(owner,options={})=>new SignJWT({email:owner,type:'app',...options}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject(owner).setIssuer('https://test.cloudflareaccess.com').setAudience('test-audience').setIssuedAt().setExpirationTime('1h').sign(privateKey);
 const tokens=Object.fromEntries(await Promise.all(['test-owner@example.invalid','other-owner@example.invalid'].map(async owner=>[owner,await token(owner)])));
 const root=resolve('dist/server');const paths=await modulesAt(root);const first=join(root,'index.js');
 let jobicyStatus=200;let jobicyJobs=[];
 let generationCalls=0;let lastGenerationRequest;let incompleteGeneration=false;
 const outboundService=async request=>{const url=new URL(request.url);
  if(url.hostname==='test.cloudflareaccess.com')return Response.json({keys:[jwk]});
  if(url.hostname==='jobicy.com'){return Response.json(jobicyStatus===200?{jobs:jobicyJobs}:{error:'Unavailable'},{status:jobicyStatus});}
  if(url.hostname==='remoteok.com'){return Response.json([]);}
  if(url.hostname==='www.arbeitnow.com')return Response.json({data:[]});
  if(url.hostname==='boards-api.greenhouse.io')return Response.json({id:7863636,title:'Staff Product Designer',company_name:'Example Co',location:{name:'Remote - USA'},content:'<p>Design systems for B2B SaaS.</p><p>$180,000–$220,000 USD</p>',updated_at:'2026-09-01T12:00:00Z',departments:[{name:'Design'}]});
  if(url.hostname==='api.smartrecruiters.com')return Response.json({id:'3743990014840366',name:'Sr. Staff Product Designer',company:{name:'Achieve',identifier:'Achieve1'},location:{remote:false,hybrid:true,fullLocation:'San Mateo, CA, United States'},function:{label:'Product Management'},customField:[{fieldLabel:'Department Name',valueLabel:'Marketing Automation'}],jobAd:{sections:{companyDescription:{text:'<p>Consumer fintech.</p>'},jobDescription:{text:'<p>Lead acquisition and zero-to-one product design.</p>'},qualifications:{text:'<p>10+ years of product design experience.</p>'},additionalInformation:{text:'<p>Salary Range: $175,000 - $220,000 USD.</p>'}}},releasedDate:'2026-08-25T15:50:42.543Z'});
  if(url.hostname==='www.linkedin.com')return new Response('<h1 class="top-card-layout__title">Senior Product Designer</h1><a class="topcard__org-name-link">Linked Example</a><span class="topcard__flavor--bullet">Remote, United States</span><div class="description__text"><div class="show-more-less-html__markup">Lead product design systems.</div></div>',{headers:{'Content-Type':'text/html'}});
  if(url.hostname==='api.openai.com'){generationCalls++;assert.equal(request.headers.get('Authorization'),'Bearer test-openai-key');lastGenerationRequest=await request.json();if(incompleteGeneration)return Response.json({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[{type:'message',content:[{type:'output_text',text:'{"opening":"Cut off'}]}]});const parts=Object.fromEntries(['opening','primaryEvidence','supportingEvidence','closing'].map((key,index)=>[key,`Example Co needs a designer who can clarify complex workflows. ${'In my approved example project, I worked with product and engineering to understand customer needs, test possible changes, and explain the decisions behind a useful interface. '.repeat(2)}This is example paragraph ${index+1}.`]));return Response.json({status:'completed',incomplete_details:null,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(parts)}]}]});}
  return new Response('Not found',{status:404});
 };
 const options={modulesRoot:root,modules:[first,...paths.filter(path=>path!==first)].map(path=>({type:'ESModule',path})),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{OPENAI_API_KEY:'test-openai-key',ACCESS_TEAM_DOMAIN:'test.cloudflareaccess.com',ACCESS_AUD:'test-audience',GENERATION_ENABLED:'true'},d1Databases:['DB'],serviceBindings:{ASSETS:()=>new Response('Not found',{status:404})},outboundService};const mf=new Miniflare(options);
 try{
  const db=await mf.getD1Database('DB');const migrations=(await readdir('drizzle')).filter(name=>name.endsWith('.sql')).sort();for(const migration of migrations){const sql=await readFile(join('drizzle',migration),'utf8');for(const statement of sql.split('--> statement-breakpoint'))await db.prepare(statement.trim()).run();}
  const call=(path,body,owner='test-owner@example.invalid')=>mf.dispatchFetch(`http://signal.test${path}`,{method:body?'POST':'GET',headers:{...(owner?{'cf-access-jwt-assertion':tokens[owner]}:{}),...(body?{'Content-Type':'application/json',Origin:'http://signal.test'}:{})},body:body?JSON.stringify(body):undefined});
  const page=await call('/');assert.equal(page.status,200);assert.match(await page.text(),/Job search activity/);
  assert.equal((await call('/api/inbox',undefined,null)).status,401);
  const forged=await mf.dispatchFetch('http://signal.test/api/inbox',{headers:{'oai-authenticated-user-email':'forged@example.invalid','oai-authenticated-user-id':'forged','cf-access-authenticated-user-email':'forged@example.invalid'}});assert.equal(forged.status,401);
  for(const invalid of [tokens['test-owner@example.invalid'].slice(0,-8)+'tampered', await new SignJWT({email:'bad@example.invalid',type:'app'}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('bad').setIssuer('https://test.cloudflareaccess.com').setAudience('wrong').setIssuedAt().setExpirationTime('1h').sign(privateKey), await new SignJWT({email:'bad@example.invalid',type:'app'}).setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject('bad').setIssuer('https://test.cloudflareaccess.com').setAudience('test-audience').setIssuedAt().setExpirationTime(1).sign(privateKey)]){assert.equal((await mf.dispatchFetch('http://signal.test/api/inbox',{headers:{'cf-access-jwt-assertion':invalid}})).status,401);}
  const initial=await call('/api/inbox');assert.equal(initial.status,200);const state=await initial.json();assert.equal(state.jobs.length,0);assert.equal(state.sources.length,3);assert.equal(state.profile.resume,'');assert.equal(state.profile.name,'');assert.equal(state.profile.onboardingComplete,false);
  const chosenProfile={...state.profile,roles:'Product Designer',location:'preferred',preferredLocations:'USA',name:'Alex Example',resume:'Private test résumé',onboardingComplete:true};
  assert.equal((await call('/api/inbox',{action:'profile',profile:chosenProfile})).status,200);
  jobicyJobs=[
   {id:'us-role',companyName:'US Example',jobTitle:'Senior Product Designer',jobGeo:'USA',url:'https://jobicy.com/jobs/us-role',jobDescription:'Design systems '.repeat(100),pubDate:'2026-09-07T10:00:00Z',salaryMin:50,salaryMax:70,salaryCurrency:'USD',salaryPeriod:'hourly'},
   {id:'uk-role',companyName:'UK Example',jobTitle:'Senior Product Designer',jobGeo:'London',url:'https://jobicy.com/jobs/uk-role',jobDescription:'Design systems '.repeat(100),pubDate:'2026-09-07T10:00:00Z'},
  ];
  const refreshed=await call('/api/refresh',{source:'jobicy:discovery'});assert.equal(refreshed.status,200,await refreshed.text());
  const discovered=await (await call('/api/inbox')).json();assert.equal(discovered.jobs.length,1);const job=discovered.jobs[0];assert.equal(job.company,'US Example');assert.match(job.location,/USA/);assert.equal(job.salaryMax,undefined);assert.match(job.salary,/hourly/);
  assert.equal((await call('/api/inbox',{action:'status',id:job.id,status:'applied'})).status,200);
  jobicyStatus=503;assert.equal((await call('/api/refresh',{source:'jobicy:discovery'})).status,502);
  const afterFailure=await (await call('/api/inbox')).json();assert.equal(afterFailure.jobs.find(item=>item.id===job.id).active,1);assert.equal(afterFailure.jobs.find(item=>item.id===job.id).status,'applied');
  const imported=await (await call('/api/inbox',{action:'importJob',url:'https://job-boards.greenhouse.io/example/jobs/7863636'})).json();const importedState=await (await call('/api/inbox')).json();const manual=importedState.jobs.find(item=>item.id===imported.id);assert.equal(manual.source,'manual');assert.equal(manual.salaryMax,220000);
  const smartUrl='https://jobs.smartrecruiters.com/oneclick-ui/company/Achieve1/publication/12f32fde-2957-4cb9-ad89-c32c9ac28654?dcr_ci=Achieve1';const smartImported=await (await call('/api/inbox',{action:'importJob',url:smartUrl})).json();const smartState=await (await call('/api/inbox')).json();const smart=smartState.jobs.find(item=>item.id===smartImported.id);assert.equal(smart.company,'Achieve');assert.equal(smart.title,'Sr. Staff Product Designer');assert.equal(smart.location,'Hybrid · San Mateo, CA, United States');assert.equal(smart.department,'Marketing Automation');assert.equal(smart.salaryMax,220000);assert.match(smart.description,/zero-to-one product design/);
  const linkedOne=await (await call('/api/inbox',{action:'importJob',url:'https://www.linkedin.com/jobs/view/senior-product-designer-1234567890?trackingId=one'})).json();const linkedTwo=await (await call('/api/inbox',{action:'importJob',url:'https://www.linkedin.com/jobs/view/1234567890?trk=two'})).json();assert.equal(linkedOne.id,linkedTwo.id);
  assert.equal((await call('/api/inbox',{action:'resetSearch'})).status,200);const reset=await (await call('/api/inbox')).json();assert.ok(reset.jobs.some(item=>item.id===job.id&&item.status==='applied'));assert.ok(reset.jobs.some(item=>item.id===imported.id));assert.ok(reset.jobs.some(item=>item.id===linkedOne.id));
  const other=await (await call('/api/inbox',undefined,'other-owner@example.invalid')).json();assert.equal(other.jobs.length,0);
  assert.equal((await call('/api/cover-letter',{id:imported.id})).status,409);assert.equal(generationCalls,0);
  const profile={...chosenProfile,minSalary:150000,evidenceApproved:true};assert.equal((await call('/api/inbox',{action:'profile',profile})).status,200);const persisted=await (await call('/api/inbox')).json();assert.equal(persisted.profile.resume,'Private test résumé');
  assert.equal((await call('/api/cover-letter',{id:imported.id},'other-owner@example.invalid')).status,404);
  const generated=await call('/api/cover-letter',{id:imported.id,regenerate:false});assert.equal(generated.status,200);const generatedBody=await generated.json();assert.match(generatedBody.content,/^Dear Example Co Hiring Team,/);assert.match(generatedBody.content,/Example Co needs a designer/);assert.match(generatedBody.content,/Sincerely,\nAlex Example$/);assert.equal(generationCalls,1);assert.equal(lastGenerationRequest.store,false);assert.equal(lastGenerationRequest.reasoning.effort,'low');assert.equal(lastGenerationRequest.max_output_tokens,3600);assert.equal(lastGenerationRequest.text.format.type,'json_schema');assert.match(lastGenerationRequest.instructions,/generic corporate copy/);assert.match(lastGenerationRequest.input,/Private test résumé/);assert.match(lastGenerationRequest.input,/Design systems for B2B SaaS/);
  const pdf=await mf.dispatchFetch('http://signal.test/api/cover-letter/pdf',{method:'POST',headers:{'cf-access-jwt-assertion':tokens['test-owner@example.invalid'],'Content-Type':'application/x-www-form-urlencoded',Origin:'http://signal.test'},body:new URLSearchParams({id:imported.id,content:generatedBody.content})});assert.equal(pdf.status,200);assert.equal(pdf.headers.get('Content-Type'),'application/pdf');assert.match(pdf.headers.get('Content-Disposition'),/^attachment; filename="Example-Co-Staff-Product-Designer-cover-letter\.pdf"$/);assert.equal(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0,5)),'%PDF-');
  const reopened=await call('/api/cover-letter',{id:imported.id,regenerate:false});assert.equal(reopened.status,200);assert.equal((await reopened.json()).content,generatedBody.content);assert.equal(generationCalls,1);
  incompleteGeneration=true;const incomplete=await call('/api/cover-letter',{id:imported.id,regenerate:true});assert.equal(incomplete.status,502);assert.equal(generationCalls,2);let savedState=await (await call('/api/inbox')).json();assert.equal(savedState.jobs.find(item=>item.id===imported.id).coverLetter,generatedBody.content);
  incompleteGeneration=false;const regenerated=await call('/api/cover-letter',{id:imported.id,regenerate:true});assert.equal(regenerated.status,200);assert.equal(generationCalls,3);savedState=await (await call('/api/inbox')).json();assert.equal(savedState.jobs.find(item=>item.id===imported.id).coverLetter,generatedBody.content);
  await mf.setOptions({...options,bindings:{ACCESS_TEAM_DOMAIN:'test.cloudflareaccess.com',ACCESS_AUD:'test-audience',GENERATION_ENABLED:'true'}});
  const noKeyState=await (await call('/api/inbox')).json();assert.equal(noKeyState.generationAvailable,false);
  assert.equal((await call('/api/cover-letter',{id:imported.id,regenerate:true})).status,503);
  assert.equal((await call('/api/cover-letter',{id:imported.id})).status,200);
  assert.equal((await call('/api/inbox',{action:'status',id:imported.id,status:'applied'})).status,200);
  assert.equal(generationCalls,3);
  assert.equal((await call('/api/inbox',{action:'status',id:job.id,status:'unsupported'})).status,400);
  assert.equal((await call('/api/inbox',{action:'source',company:'Fake',url:'https://localhost/internal'})).status,400);
 }finally{await mf.dispose();}
});
