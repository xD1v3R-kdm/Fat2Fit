import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {ApiError,isUuid,requireUser,jsonError,parseText} from '@/lib/http';
import {VIDEO_BUCKET,MAX_VIDEO_BYTES} from '@/lib/videos';

export async function PATCH(request:Request,{params}:{params:Promise<{id:string;videoId:string}>}){try{
 const {id,videoId}=await params,userId=await requireUser(),b=await request.json();
 if(!isUuid(id)||!isUuid(videoId))throw new ApiError(400,'Invalid identifiers');
 const row=await query<{status:string;role:string;student_user_id:string;storage_path:string;mime_type:string;bytes_declared:string;assignment_status:string;history_visibility:string}>(`select v.status,m.role,a.student_user_id,v.storage_path,v.mime_type,v.bytes_declared,a.status as assignment_status,m.history_visibility from workout_videos v join assignments a on a.id=v.assignment_id join memberships m on m.workspace_id=a.workspace_id and m.user_id=$3 where v.id=$1 and v.assignment_id=$2 and (m.role='coach' or (m.role='student' and a.student_user_id=$3))`,[videoId,id,userId]);
 const v=row.rows[0];if(!v)throw new ApiError(403,'Video access denied');
 if(v.role==='student'&&v.history_visibility==='summary'&&['completed','skipped'].includes(v.assignment_status))
  throw new ApiError(403,'Workout history is restricted');
 if(b.action==='confirm'){
  if(v.student_user_id!==userId)throw new ApiError(403,'Only the student can confirm upload');
  if(v.status!=='uploading')throw new ApiError(409,'Video already confirmed');
  // Supabase Storage metadata is written after the upload completes.
  const object=await query<{name:string;size:string;mime:string}>(`select name,coalesce(metadata->>'size','0') as size,coalesce(metadata->>'mimetype','') as mime from storage.objects where bucket_id=$1 and name=$2`,[VIDEO_BUCKET,v.storage_path]);
  const saved=object.rows[0];if(!saved)throw new ApiError(409,'Video has not finished uploading');
  if(!Number.isFinite(Number(saved.size))||Number(saved.size)<=0||Number(saved.size)>MAX_VIDEO_BYTES||Number(saved.size)>Number(v.bytes_declared)+1024||saved.mime!==v.mime_type)throw new ApiError(400,'Uploaded video does not match the submission');
  await query(`update workout_videos set status='pending',uploaded_at=now() where id=$1 and status='uploading'`,[videoId]);
  return NextResponse.json({ok:true,status:'pending'});
 }
 if(b.action!=='review'||v.role!=='coach')throw new ApiError(403,'Only a coach can review videos');
 if(!['approved','changes_requested'].includes(b.status))throw new ApiError(400,'Invalid review');
 if(!['pending','approved','changes_requested'].includes(v.status))throw new ApiError(409,'Video is not ready');
 const note=parseText(b.note,2000);
 if(b.status==='changes_requested'&&!note)throw new ApiError(400,'Please explain the correction');
 await query(`update workout_videos set status=$1,review_note=$2,reviewed_by=$3,reviewed_at=now() where id=$4 and status in ('pending','approved','changes_requested')`,[b.status,note,userId,videoId]);
 return NextResponse.json({ok:true,status:b.status});
}catch(e){return jsonError(e);}}
