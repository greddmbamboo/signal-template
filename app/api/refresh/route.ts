import {getUser} from '../../auth';
import {fetchSource} from '../../../lib/feeds';
import {initialize,saveFeed,getSource,getProfile,recordSourceError} from '../../../lib/store';
import {fetchDiscovery} from '../../../lib/discovery';
import {matchesLocationPreference,matchesTargetRole} from '../../../lib/model';
export async function POST(request:Request){
 const user=await getUser();if(!user)return Response.json({error:'Please sign in again.'},{status:401});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Request origin is not allowed.'},{status:403});
 try{const body=await request.json() as {source?:unknown};if(typeof body.source!=='string'||body.source.length>200)return Response.json({error:'Choose a source.'},{status:400});await initialize(user.id);const source=await getSource(user.id,body.source);if(!source)return Response.json({error:'Source not found.'},{status:404});
 try{const profile=await getProfile(user.id);const found=['jobicy','remoteok','arbeitnow'].includes(source.provider)?await fetchDiscovery(source,profile):await fetchSource(source);return Response.json({source:await saveFeed(user.id,source,found)})}catch(e){console.error('source check failed',source.id,e);const message=e instanceof Error&&/returned HTTP|too large/.test(e.message)?e.message:'The feed could not be reached or read. Existing listings were kept.';await recordSourceError(user.id,source,message);return Response.json({error:`${source.company}: ${message}`},{status:502});}
 }catch(e){console.error('refresh',e);return Response.json({error:'The source check could not finish. Please try again.'},{status:500})}
}
