/** Shared student upload constraints; the private Supabase bucket enforces these too. */
export const MAX_VIDEO_BYTES=50*1024*1024;
export const VIDEO_TYPES:Record<string,string>={
 'video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm'
};
export function videoExtension(mime:unknown,size:unknown):string|null{
 if(typeof mime!=='string'||!Object.hasOwn(VIDEO_TYPES,mime))return null;
 if(typeof size!=='number'||!Number.isSafeInteger(size)||size<=0||size>MAX_VIDEO_BYTES)return null;
 return VIDEO_TYPES[mime];
}
