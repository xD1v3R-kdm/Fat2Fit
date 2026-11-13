import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {ApiError,isUuid,requireUser,jsonError,parseText} from '@/lib/http';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params,userId=await requireUser(),b=await request.json();
  if(!isUuid(id)||!['approved','changes_requested'].includes(b?.status))
    throw new ApiError(400,'Invalid review');
  const note=parseText(b?.note,2000);
  if(b.status==='changes_requested'&&!note)
   throw new ApiError(400,'Explain what the student needs to change');
  const r=await query(`update assignments a
    set review_status=$3,review_note=$4,reviewed_by=$2,reviewed_at=now(),
        status=case when $3='changes_requested' then 'active' else a.status end
    from workspaces w
    where a.id=$1 and a.workspace_id=w.id and w.owner_user_id=$2
      and a.status='completed' and a.student_user_id<>$2
      and a.review_status in ('pending','approved','changes_requested')
    returning a.id`,[id,userId,b.status,note]);
  if(!r.rowCount)throw new ApiError(403,'Workout review unavailable');
  return NextResponse.json({ok:true,reviewStatus:b.status});
 }catch(e){return jsonError(e);}
}
