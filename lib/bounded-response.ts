export async function boundedText(response:Response,maxBytes:number){
 if(Number(response.headers.get('content-length')||0)>maxBytes){await response.body?.cancel();throw new Error('Response too large.');}
 const reader=response.body?.getReader();if(!reader)return '';const decoder=new TextDecoder();let size=0,text='';
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw new Error('Response too large.');text+=decoder.decode(value,{stream:true});}return text+decoder.decode();}finally{await reader.cancel();reader.releaseLock();}
}

