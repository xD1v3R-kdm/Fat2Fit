import 'server-only';
import {ApiError} from './http';
import {MAX_VIDEO_BYTES,VIDEO_TYPES,videoExtension} from './video-rules';
export {MAX_VIDEO_BYTES,VIDEO_TYPES};

export const VIDEO_BUCKET='fat2fit-workout-videos';
function storageConfig(){
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!/^https:\/\/[\w.-]+\.supabase\.co$/.test(url)||!key)throw new ApiError(503,'Video storage is not configured');
 return {url:`${url}/storage/v1`,key};
}
export function validateVideoFile(mime:unknown,size:unknown){
 const ext=videoExtension(mime,size);
 if(!ext)throw new ApiError(400,'Video must be MP4, MOV, or WebM and 50 MB or smaller');
 return ext;
}
export async function signedUploadUrl(path:string){
 const {url,key}=storageConfig();
 const res=await fetch(`${url}/object/upload/sign/${VIDEO_BUCKET}/${path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
 if(!res.ok)throw new ApiError(502,'Unable to prepare video upload');
 const body=await res.json() as {url?:string};
 if(!body.url)throw new ApiError(502,'Upload URL missing');
 const signed=new URL(body.url.startsWith('/')?`${url}${body.url}`:body.url);
 if(signed.origin!==new URL(url).origin||!signed.pathname.startsWith('/storage/v1/object/'))throw new ApiError(502,'Invalid storage URL');
 return signed.toString();
}
export async function signedPlaybackUrl(path:string){
 const {url,key}=storageConfig();
 const res=await fetch(`${url}/object/sign/${VIDEO_BUCKET}/${path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:300}),cache:'no-store'});
 if(!res.ok)throw new ApiError(502,'Unable to open video');
 const body=await res.json() as {signedURL?:string};
 if(!body.signedURL)throw new ApiError(502,'Playback URL missing');
 const signed=new URL(body.signedURL.startsWith('/')?`${url}${body.signedURL}`:body.signedURL);
 if(signed.origin!==new URL(url).origin||!signed.pathname.startsWith('/storage/v1/object/'))throw new ApiError(502,'Invalid video link');
 return signed.toString();
}
