import { env } from 'cloudflare:workers';
import {z} from 'zod';
import {getUser} from '../../auth';
import {getSql} from '../../../db';
import {readInbox,initialize} from '../../../lib/store';
import {plainText,salaryFrom,sourceFromUrl} from '../../../lib/model';
import {importJobUrl} from '../../../lib/job-import';
const profileSchema=z.object({roles:z.string().trim().min(1).max(1000),skills:z.string().max(1000),resume:z.string().max(40000),location:z.enum(['preferred','all','remote']),minSalary:z.number().min(0).max(1000000),minQuality:z.number().min(0).max(100),name:z.string().trim().max(120).default(''),preferredLocations:z.string().max(1000).default(''),portfolio:z.string().max(40000).default(''),evidenceApproved:z.boolean().default(false),onboardingComplete:z.boolean().default(false)});
const actionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('status'),id:z.string().max(250),status:z.enum(['inbox','applied','rejected','passed']),reason:z.string().max(500).optional()}),
 z.object({action:z.literal('coverLetter'),id:z.string().max(250),content:z.string().max(20000)}),
 z.object({action:z.literal('manualJob'),url:z.string().url().max(1000),company:z.string().min(1).max(120),title:z.string().min(1).max(200),location:z.string().max(200),salary:z.string().max(200),description:z.string().max(40000)}),
 z.object({action:z.literal('importJob'),url:z.string().url().max(1000)}),
 z.object({action:z.literal('resetSearch')}),
 z.object({action:z.literal('profile'),profile:profileSchema}),
 z.object({action:z.literal('source'),company:z.string().min(1).max(80),url:z.string().url().max(500)})
]);
export async function GET(){const user=await getUser();if(!user)return Response.json({error:'Please sign in to open your inbox.'},{status:401});try{return Response.json({...await readInbox(user.id),generationAvailable:Boolean(env.OPENAI_API_KEY)&&env.GENERATION_ENABLED!=='false'},{headers:{'Cache-Control':'no-store'}})}catch(e){console.error('inbox read',e);return Response.json({error:'Your inbox could not be loaded. Please try again.'},{status:500})}}
export async function POST(request:Request){
 const user=await getUser();if(!user)return Response.json({error:'Please sign in again.'},{status:401});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Request origin is not allowed.'},{status:403});
 try{const raw=await request.text();if(raw.length>100000)return Response.json({error:'The request is too long.'},{status:413});const a=actionSchema.parse(JSON.parse(raw));await initialize(user.id);const db=getSql();let changedId:string|undefined;
 if(a.action==='status'){const inbox=await readInbox(user.id);const job=inbox.jobs.find(j=>j.id===a.id||j.duplicateIds?.includes(a.id));if(!job)return Response.json({error:'Listing not found.'},{status:404});await db.batch((job.duplicateIds||[job.id]).map(id=>db.prepare('UPDATE jobs SET status = ?, reason = ? WHERE owner = ? AND id = ?').bind(a.status,a.reason||'',user.id,id)));}
 if(a.action==='coverLetter'){const result=await db.prepare('UPDATE jobs SET cover_letter = ? WHERE owner = ? AND id = ?').bind(a.content,user.id,a.id).run();if(!result.meta.changes)return Response.json({error:'Listing not found.'},{status:404});}
 if(a.action==='manualJob'){
  const url=new URL(a.url);if(url.protocol!=='https:')return Response.json({error:'Use a secure HTTPS job-listing URL.'},{status:400});for(const key of [...url.searchParams.keys()])if(/^utm_|^(trk|trackingId|ref|source)$/i.test(key))url.searchParams.delete(key);url.hash='';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url.toString()));const id=`manual:${[...new Uint8Array(digest)].slice(0,16).map(n=>n.toString(16).padStart(2,'0')).join('')}`;const now=new Date().toISOString();const description=plainText(a.description).slice(0,40000);const detected=salaryFrom(`${a.salary}\n${description}`);const linkedinUrl=/^(www\.)?linkedin\.com$/i.test(url.hostname)?url.toString():'';
  const payload={source:'manual',company:a.company.trim(),title:a.title.trim(),location:a.location.trim()||'Not specified',url:url.toString(),description,department:'',...detected,salary:a.salary.trim()||detected.salary,origin:'manual'};
  await db.prepare("INSERT INTO jobs (owner,id,source,payload,status,reason,cover_letter,linkedin_url,linkedin_id,first_seen,last_seen,active) VALUES (?,?,?,?, 'inbox','', '', ?, '', ?, ?, 1) ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload, linkedin_url=excluded.linkedin_url, last_seen=excluded.last_seen, active=1").bind(user.id,id,'manual',JSON.stringify(payload),linkedinUrl,now,now).run();
  changedId=id;
 }
 if(a.action==='importJob'){
  const imported=await importJobUrl(a.url);const canonical=new URL(imported.url);for(const key of [...canonical.searchParams.keys()])if(/^utm_|^(trk|trackingId|ref|source)$/i.test(key))canonical.searchParams.delete(key);canonical.hash='';const identity=imported.linkedinId?`https://www.linkedin.com/jobs/view/${imported.linkedinId}`:canonical.toString();const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));const id=`manual:${[...new Uint8Array(digest)].slice(0,16).map(n=>n.toString(16).padStart(2,'0')).join('')}`;const now=new Date().toISOString();const {linkedinUrl,linkedinId,...details}=imported;const payload={source:'manual',...details,url:canonical.toString(),origin:'manual'};
  await db.prepare("INSERT INTO jobs (owner,id,source,payload,status,reason,cover_letter,linkedin_url,linkedin_id,first_seen,last_seen,active) VALUES (?,?,?,?, 'inbox','', '', ?, ?, ?, ?, 1) ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload, linkedin_url=excluded.linkedin_url, linkedin_id=excluded.linkedin_id, last_seen=excluded.last_seen, active=1").bind(user.id,id,'manual',JSON.stringify(payload),linkedinUrl,linkedinId,now,now).run();changedId=id;
 }
 if(a.action==='resetSearch')await db.prepare("DELETE FROM jobs WHERE owner = ? AND source != 'manual' AND status NOT IN ('applied','rejected')").bind(user.id).run();
 if(a.action==='profile')await db.prepare('UPDATE preferences SET payload = ? WHERE owner = ?').bind(JSON.stringify(a.profile),user.id).run();
 if(a.action==='source'){const ss=await db.prepare('SELECT COUNT(*) AS count FROM sources WHERE owner = ?').bind(user.id).first<{count:number}>();if(ss!.count>=75)return Response.json({error:'Signal currently supports up to 75 company boards.'},{status:400});const s=sourceFromUrl(a.company,a.url);await db.prepare('INSERT INTO sources (owner,id,payload) VALUES (?,?,?) ON CONFLICT DO NOTHING').bind(user.id,s.id,JSON.stringify(s)).run();}
 return Response.json({ok:true,id:changedId});
 }catch(e){if(e instanceof z.ZodError)return Response.json({error:'Please check the form fields.'},{status:400});const message=e instanceof Error?e.message:'';const safe=/^(Use a (?:secure|public) HTTPS|Use a Greenhouse|The listing |That URL |Signal could not identify|Greenhouse |SmartRecruiters )/.test(message);if(!safe)console.error('inbox change',e);return Response.json({error:safe?message:'The change could not be saved. Please try again.'},{status:400})}
}
