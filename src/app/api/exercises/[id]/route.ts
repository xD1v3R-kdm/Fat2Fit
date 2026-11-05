import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {ApiError,isUuid,parseText,requireWorkspace,jsonError,validTitle,validUrl} from '@/lib/http';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {id}=await params,b=await request.json();if(!isUuid(id))throw new ApiError(400,'Invalid exercise');
 const ws=b.workspaceId;await requireWorkspace(ws,['coach']);
 const translations:Record<string,{name:string;description:string;faq:string}>={};
 for(const l of ['ru','en','sr']){const x=b.translations?.[l]||{};translations[l]={name:parseText(x.name,120),description:parseText(x.description,3000),faq:parseText(x.faq,2000)};}
 validTitle(Object.fromEntries(Object.entries(translations).map(([k,v])=>[k,v.name])));
 const r=await query('update exercises set translations=$1::jsonb,muscle_group=$2,equipment=$3,photo_url=$4,video_url=$5 where id=$6 and workspace_id=$7 returning id',[JSON.stringify(translations),parseText(b.group,30)||'other',parseText(b.equipment,120),validUrl(b.photoUrl),validUrl(b.videoUrl),id,ws]);
 if(!r.rowCount)throw new ApiError(404,'Editable exercise not found');
 return NextResponse.json({ok:true});
}catch(e){return jsonError(e);}}
