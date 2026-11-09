import {NextResponse} from 'next/server';
import {query,transaction} from '@/lib/db';
import {ApiError,isUuid,parseText,requireWorkspace,jsonError,validTitle,validUrl} from '@/lib/http';

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params,b=await request.json();
  if(!isUuid(id))throw new ApiError(400,'Invalid exercise');
  const ws=b.workspaceId,{userId}=await requireWorkspace(ws,['coach']);
  const translations:Record<string,{name:string;description:string;faq:string}>={};
  for(const l of ['ru','en','cg']){
   const x=b.translations?.[l]||{};
   translations[l]={name:parseText(x.name,120),description:parseText(x.description,3000),faq:parseText(x.faq,2000)};
  }
  validTitle(Object.fromEntries(Object.entries(translations).map(([k,v])=>[k,v.name])));
  const group=parseText(b.group,30)||'other',equipment=parseText(b.equipment,120);
  const photoUrl=validUrl(b.photoUrl),videoUrl=validUrl(b.videoUrl),data=JSON.stringify(translations);
  await transaction(async client=>{
   const found=await client.query<{workspace_id:string|null}>(
    'select workspace_id from exercises where id=$1 and (workspace_id is null or workspace_id=$2) for update',[id,ws]);
   if(!found.rows.length)throw new ApiError(404,'Exercise not found');
   if(found.rows[0].workspace_id===null){
    // The shared library remains untouched. Edits apply to this workspace only,
    // preserving exercise IDs in existing workout templates and assignments.
    await client.query(`insert into exercise_overrides
      (workspace_id,exercise_id,translations,muscle_group,equipment,photo_url,video_url,updated_by)
      values($1,$2,$3::jsonb,$4,$5,$6,$7,$8)
      on conflict(workspace_id,exercise_id) do update set
      translations=excluded.translations,muscle_group=excluded.muscle_group,
      equipment=excluded.equipment,photo_url=excluded.photo_url,video_url=excluded.video_url,
      updated_by=excluded.updated_by,updated_at=now()`,
      [ws,id,data,group,equipment,photoUrl,videoUrl,userId]);
   }else{
    await client.query(`update exercises set translations=$1::jsonb,muscle_group=$2,equipment=$3,
      photo_url=$4,video_url=$5 where id=$6 and workspace_id=$7`,
      [data,group,equipment,photoUrl,videoUrl,id,ws]);
   }
  });
  return NextResponse.json({ok:true});
 }catch(e){return jsonError(e);}
}
