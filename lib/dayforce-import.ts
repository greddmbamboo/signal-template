import {plainText,salaryFrom} from './model.ts';

// Dayforce's current portal embeds job data in Next.js page props, not JSON-LD.
export function dayforceJob(html:string,url:URL,strict=false){
 if(url.hostname!=='jobs.dayforcehcm.com')return null;
 const route=url.pathname.match(/^\/(?:[a-z]{2}-[a-z]{2}\/)?([^/]+)\/([^/]+)\/jobs\/(\d+)\/?$/i);
 if(!route)throw new Error('The listing is not a supported Dayforce job URL.');
 const script=html.match(/<script\b[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
 let page:any;try{page=JSON.parse(script?.[1]||'').props?.pageProps;}catch{}
 const job=page?.jobData;
 const site=page?.dehydratedState?.queries?.find((q:any)=>q?.queryKey?.[0]==='site-info'&&String(q?.state?.data?.clientNamespace).toLowerCase()===route[1].toLowerCase())?.state?.data;
 const title=plainText(job?.jobTitle||'');
 const company=plainText(site?.candidateCorrespondenceClientName||'').replace(/\s+(?:Talent|Recruiting|Recruitment|Hiring) Team$/i,'').trim();
 const content=job?.jobPostingContent;
 const description=plainText([content?.jobDescriptionHeader,content?.jobDescription,content?.jobDescriptionFooter].filter(Boolean).join('\n\n'));
 if(String(job?.jobPostingId)!==route[3]||!title||!company||!plainText(content?.jobDescription||''))throw new Error('The listing did not provide complete Dayforce job details. Nothing was saved.');
 if(description.length>40000)throw new Error('The listing description is too long to import completely. Nothing was saved.');
 const date=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():undefined;
 const validThrough=date(job.postingExpiryTimestampUTC);
 if(strict&&validThrough&&Date.parse(validThrough)<Date.now())throw new Error('Listing explicitly expired.');
 const locations=Array.isArray(job.postingLocations)?job.postingLocations:[];
 const place=[...new Set(locations.map((p:any)=>plainText(p.formattedAddress||[p.cityName,p.stateCode,p.isoCountryCode].filter(Boolean).join(', '))).filter(Boolean))].join(' · ');
 const location=job.hasVirtualLocation===true?['Remote',place].filter(Boolean).join(' · '):place||'Not specified';
 const attrs=Array.isArray(job.jobPostingAttributes)?job.jobPostingAttributes:[];
 const value=(name:string)=>attrs.find((a:any)=>a.name===name)?.value;
 const min=value('HiringMinRate'),max=value('HiringMaxRate'),currency=job.isoCurrencyRegion;
 let salary=salaryFrom(description);
 if(value('PayType')==='Salary'&&currency==='USD'&&typeof min==='number'&&Number.isFinite(min)&&min>0&&typeof max==='number'&&Number.isFinite(max)&&max>=min){
  salary={salary:`$${min.toLocaleString('en-US')}–$${max.toLocaleString('en-US')} USD / year`,salaryMin:min,salaryMax:max};
 }
 return {url:url.toString(),title,company,description,location,department:'',...salary,postedAt:date(job.postingStartTimestampUTC),updatedAt:date(job.lastModifiedTimestampUTC),validThrough,requisitionId:String(job.jobReqId||job.jobPostingId),verification:'employer' as const,linkedinUrl:'',linkedinId:''};
}

