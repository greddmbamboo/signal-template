import {getSql} from '../db';
import {dedupeJobs,defaultProfile,defaultSources,type Job,type Profile,type Source} from './model';
export async function initialize(owner:string){
 const db=getSql();
 await db.batch([
  db.prepare('INSERT INTO preferences (owner,payload) VALUES (?,?) ON CONFLICT DO NOTHING').bind(owner,JSON.stringify(defaultProfile)),
  ...defaultSources.map(source=>db.prepare('INSERT INTO sources (owner,id,payload) VALUES (?,?,?) ON CONFLICT DO NOTHING').bind(owner,source.id,JSON.stringify(source)))
 ]);
}
export async function readInbox(owner:string){await initialize(owner);const db=getSql();const [rows,p,ss]=await Promise.all([db.prepare('SELECT id,payload,status,reason,cover_letter,linkedin_url,linkedin_id,first_seen,last_seen,active FROM jobs WHERE owner = ?').bind(owner).all<{id:string;payload:string;status:string;reason:string;cover_letter:string;linkedin_url:string;linkedin_id:string;first_seen:string;last_seen:string;active:number}>(),db.prepare('SELECT payload FROM preferences WHERE owner = ?').bind(owner).first<{payload:string}>(),db.prepare("SELECT payload FROM sources WHERE owner = ? AND id NOT LIKE 'maintenance:%'").bind(owner).all<{payload:string}>()]);const jobs=rows.results.map(r=>({...JSON.parse(r.payload),id:r.id,status:r.status,reason:r.reason,coverLetter:r.cover_letter,linkedinUrl:r.linkedin_url,linkedinId:r.linkedin_id,firstSeen:r.first_seen,lastSeen:r.last_seen,active:r.active})) as Job[];return {jobs:dedupeJobs(jobs),profile:JSON.parse(p!.payload) as Profile,sources:ss.results.map(s=>JSON.parse(s.payload)) as Source[]};}
export async function getSource(owner:string,id:string){const row=await getSql().prepare('SELECT payload FROM sources WHERE owner = ? AND id = ?').bind(owner,id).first<{payload:string}>();return row?JSON.parse(row.payload) as Source:null;}
export async function getProfile(owner:string){const row=await getSql().prepare('SELECT payload FROM preferences WHERE owner = ?').bind(owner).first<{payload:string}>();return row?JSON.parse(row.payload) as Profile:defaultProfile;}
export async function recordSourceError(owner:string,source:Source,error:string){await getSql().prepare('UPDATE sources SET payload = ? WHERE owner = ? AND id = ?').bind(JSON.stringify({...source,error}),owner,source.id).run();}
export async function saveFeed(owner:string,source:Source,found:Job[]){
 const db=getSql();const now=new Date().toISOString();const statements=[db.prepare('UPDATE jobs SET active = 0 WHERE owner = ? AND source = ?').bind(owner,source.id)];
 for(const j of found){const {status,reason,coverLetter='',linkedinUrl='',linkedinId='',firstSeen,lastSeen,active,...payload}=j;statements.push(db.prepare('INSERT INTO jobs (owner,id,source,payload,status,reason,cover_letter,linkedin_url,linkedin_id,first_seen,last_seen,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload,last_seen=excluded.last_seen,active=1').bind(owner,j.id,j.source,JSON.stringify(payload),status,reason,coverLetter,linkedinUrl,linkedinId,firstSeen,lastSeen,active));}
 const next={...source,checkedAt:now,count:found.length,error:undefined};statements.push(db.prepare('UPDATE sources SET payload = ? WHERE owner = ? AND id = ?').bind(JSON.stringify(next),owner,source.id));await db.batch(statements);return next;
}
