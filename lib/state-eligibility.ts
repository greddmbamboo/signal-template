type Eligibility = {status:'unspecified'|'eligible'|'excluded'|'review'; reason:string};
const states:Record<string,string> = {
 AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia'
};
const names = Object.values(states).sort((a,b)=>b.length-a.length).join('|');
const codes = Object.keys(states).join('|');
export function stateCodeForLocation(value:string){
 const text=value||'';
 for(const [code,name] of Object.entries(states))if(new RegExp(`\\b${name}\\b`,'i').test(text)||new RegExp(`\\b${code}\\b`).test(text))return code;
 return '';
}
function foundStates(text:string){
 const found = new Set<string>();
 for(const [code,name] of Object.entries(states)) {
  if(new RegExp(`\\b${name}\\b`,'i').test(text)||new RegExp(`\\b${code}\\b`).test(text))found.add(code);
 }
 return found;
}

// Deliberately conservative: only explicit hiring/residency clauses or a
// state-only remote location are authoritative. Other restrictions need review.
// No persistence changes: this evaluates existing and newly imported records.
export function stateEligibility(job:{location:string;description?:string},homeState='UT'):Eligibility {
 const home=states[homeState]||homeState;
 const verdicts:boolean[]=[];let uncertain=false;
 function list(text:string,excluded:boolean){
  // Consume only the adjacent enumeration, never distant office/pay mentions.
  let rest=text.trim().replace(/^(?:residents of\s+)?(?:(?:one of\s+)?(?:the\s+)?following\s+)?(?:states?\s*)?[:\-]?\s*/i,'');
  const found=new Set<string>();
  for(let i=0;i<51;i++){
   const token=rest.match(new RegExp(`^(?:${names})\\b`,'i'))||rest.match(new RegExp(`^(?:${codes})\\b`));
   if(!token)break;
   for(const code of foundStates(token[0]))found.add(code);
   rest=rest.slice(token[0].length).replace(/^\s*(?:[,;/•·]|\n|\band\b|\bor\b|\s)+\s*/i,'');
  }
  if(!found.size){uncertain=true;return;}
  // Examples/preferences are not exhaustive allowed-state lists.
  if(/\b(?:such as|including|for example|preferred|preference|e\.g)\b/i.test(text)&&!excluded){uncertain=true;return;}
  if(excluded){if(found.has(homeState))verdicts.push(false);}
  else verdicts.push(found.has(homeState));
 }
 const location=job.location||'';
 const locationStates=foundStates(location);
 if(/\bremote\b/i.test(location)&&locationStates.size){
  const residue=location.replace(new RegExp(names,'gi'),'').replace(new RegExp(`\\b(${codes})\\b`,'g'),'').replace(/\b(?:remote|only|and|or)\b/gi,'').replace(/[\s,;:()\/·–—-]/g,'');
  if(!residue)list(location.replace(/^\s*remote\s*[-:·–—(]?\s*/i,''),false);
 }
 const text=`${location}\n${job.description||''}`.replace(/\r/g,'').replace(/<[^>]+>/g,' ');
 const clauses=text.split(/(?<=[.!?])\s+|\n\s*\n/);
 for(const clause of clauses){
  if(/\bnot (?:required|necessary) to (?:live|reside|be based)\b/i.test(clause))continue;
  const negative=clause.match(/(?:cannot|can not|can't|do not|don't|unable to|not able to)\s+(?:currently\s+)?(?:hire|employ|accept (?:candidates|applicants))\s+(?:(?:candidates|applicants|residents|people|employees)\s+)?(?:(?:who|that)\s+)?(?:(?:live|reside|are based)\s+)?(?:in|from|of)\s+([\s\S]+)/i)
   ||clause.match(/(?:not (?:eligible|available|open)|unavailable|not hiring)\s+(?:for|to|in)\s+(?:residents of\s+)?([\s\S]+)/i)
   ||clause.match(/(?:remote|work|employment|hiring|candidates|applicants)[\s\S]{0,100}?\b(?:except|excluding)\s+([\s\S]+)/i);
  if(negative){list(negative[1],true);continue;}
  const excludedResidents=clause.match(/(?:residents|candidates|applicants)\s+(?:of|in|from)\s+([\s\S]+?)\s+(?:are\s+)?not eligible/i);
  if(excludedResidents){list(excludedResidents[1],true);continue;}
  const allow=clause.match(/(?:must|are required to)\s+(?:currently\s+)?(?:live|reside|be (?:based|located))\s+in\s+([\s\S]+)/i)
   ||clause.match(/(?:can|may|are able to)\s+only\s+(?:hire|employ)\s+(?:candidates\s+|applicants\s+|residents\s+)?(?:in|from|of)\s+([\s\S]+)/i)
   ||clause.match(/(?:eligible|approved|permitted|allowed|hiring)\s+states\s*(?:are|include|:|-)\s*([\s\S]+)/i)
   ||clause.match(/(?:role|position|remote work|remote employment|hiring)\s+(?:is\s+)?(?:only\s+)?(?:available|open|limited|restricted)\s+(?:only\s+)?(?:to|in)\s+(?:candidates\s+|applicants\s+|residents\s+)?(?:living\s+in\s+|based\s+in\s+|of\s+)?([\s\S]+)/i);
  if(allow){
   if(foundStates(allow[1]).size)list(allow[1],false);
   else if(/\bstates?\b/i.test(allow[1])&&!/^(?:the\s+)?United States\b/i.test(allow[1]))uncertain=true;
  }
  if(/(?:remote|hiring|employment|eligible|residen)[\s\S]{0,90}\b(?:certain|select|selected|specific|approved) states\b|state[- ](?:based |residency )?restrictions (?:apply|may apply)/i.test(clause))uncertain=true;
 }
 if(verdicts.includes(false)&&verdicts.includes(true))return {status:'review',reason:`Conflicting ${home} eligibility — review listing`};
 if(verdicts.includes(false))return {status:'excluded',reason:`State restriction excludes ${home}`};
 if(uncertain)return {status:'review',reason:`Confirm ${home} eligibility — state restrictions`};
 if(verdicts.includes(true))return {status:'eligible',reason:`${home} included in eligible states`};
 return {status:'unspecified',reason:''};
}
