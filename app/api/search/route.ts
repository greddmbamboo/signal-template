import {getSql} from '../../../db';
import {env} from 'cloudflare:workers';
import {getUser} from '../../auth';
import {getProfile} from '../../../lib/store';
import {runSearchStep,searchUsage} from '../../../lib/brave-search';
import {followupQueue,verifyStoredJob} from '../../../lib/employer-followup';
import {searchPlan} from '../../../lib/search-policy';

export async function GET(){
 const user=await getUser();if(!user)return Response.json({error:'Please sign in.'},{status:401});
 try{const history=await getSql().prepare('SELECT payload FROM search_cache WHERE key=?').bind('report:'+user.id).first<{payload:string}>();return Response.json({reports:history?JSON.parse(history.payload):[],configured:Boolean(env.BRAVE_SEARCH_API_KEY),usage:await searchUsage(),total:searchPlan(await getProfile(user.id)).length},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Search status unavailable.'},{status:503});}
}
export async function POST(request:Request){
 const user=await getUser();if(!user)return Response.json({error:'Please sign in.'},{status:401});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Request origin is not allowed.'},{status:403});
 const key=env.BRAVE_SEARCH_API_KEY||'';
 try{
  const text=await request.text();if(text.length>1000)return Response.json({error:'Request too long.'},{status:413});
  const body=JSON.parse(text);
  if(body.action==='followupQueue')return Response.json(await followupQueue(user.id));
  if(body.action==='verify'){if(typeof body.id!=='string'||body.id.length>250)return Response.json({error:'Invalid listing.'},{status:400});return Response.json(await verifyStoredJob(user.id,body.id,key));}
  if(!key)return Response.json({error:'Brave is not connected. Free feeds still work.'},{status:503});
  if(!Number.isInteger(body.index)||body.index<0||body.index>=24)return Response.json({error:'Invalid search step.'},{status:400});
  const batch=body.batch??0;if(!Number.isInteger(batch)||batch<0||batch>3)return Response.json({error:'Invalid search batch.'},{status:400});
  return Response.json(await runSearchStep(user.id,await getProfile(user.id),body.index,key,batch),{headers:{'Cache-Control':'no-store'}});
 }catch(error){const message=error instanceof Error?error.message:'';console.error('Search step failed',message.replace(/BSA\S+/g,'[redacted]'));return Response.json({error:/^(Brave |Monthly search |This query |Invalid search)/.test(message)?message:'Search step failed; existing jobs were kept.'},{status:502});}
}
