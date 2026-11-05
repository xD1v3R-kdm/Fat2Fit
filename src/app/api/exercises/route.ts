import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {ApiError,requireWorkspace,jsonError,parseText,validUrl,validTitle} from '@/lib/http';
export async function GET(request:Request){try{
const ws=new URL(request.url).searchParams.get('workspaceId')||'';
await requireWorkspace(ws);
const r=await query('select id,workspace_id as "workspaceId",muscle_group as "group",equipment,photo_url as "photoUrl",video_url as "videoUrl",translations from exercises where workspace_id is null or workspace_id=$1 order by created_at,id',[ws]);
return NextResponse.json(r.rows);
}catch(e){return jsonError(e);}}
export async function POST(request:Request){try{
const b=await request.json();const ws=b.workspaceId;
const {userId}=await requireWorkspace(ws,['coach']);
const translations:Record<string,{name:string;description:string;faq:string}>={};
if(!b.translations||typeof b.translations!=='object')throw new ApiError(400,'Missing translations');
for(const lang of ['ru','en','sr']){
const v=b.translations[lang]||{};
translations[lang]={name:parseText(v.name,120),description:parseText(v.description,3000),faq:parseText(v.faq,2000)};
}
validTitle(Object.fromEntries(Object.entries(translations).map(([k,v])=>[k,v.name])));
const group=parseText(b.group,30)||'other',equipment=parseText(b.equipment,120);
const photoUrl=validUrl(b.photoUrl),videoUrl=validUrl(b.videoUrl);
const r=await query<{id:string}>('insert into exercises(workspace_id,muscle_group,equipment,photo_url,video_url,translations,created_by) values($1,$2,$3,$4,$5,$6::jsonb,$7) returning id',[ws,group,equipment,photoUrl,videoUrl,JSON.stringify(translations),userId]);
return NextResponse.json({id:r.rows[0].id},{status:201});
}catch(e){return jsonError(e);}}
