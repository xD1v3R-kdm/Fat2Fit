import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {ApiError,isUuid,requireUser,jsonError,parseText} from '@/lib/http';
import {VIDEO_BUCKET,MAX_VIDEO_BYTES,signedPlaybackUrl,signedUploadUrl,validateVideoFile} from '@/lib/videos';

async function permission(id:string,userId:string){
 const result=await query<{workspace_id:string;student_user_id:string;role:string;status:string;history_visibility:string}>(`select a.workspace_id,a.student_user_id,m.role,a.status,m.history_visibility from assignments a join memberships m on m.workspace_id=a.workspace_id and m.user_id=$2 where a.id=$1 and (m.role='coach' or (m.role='student' and a.student_user_id=$2))`,[id,userId]);
 if(!result.rows[0])throw new ApiError(403,'Workout access denied');
 if(result.rows[0].role==='student'&&result.rows[0].history_visibility==='summary'&&
 ['completed','skipped'].includes(result.rows[0].status))throw new ApiError(403,'Workout history is restricted');
 return result.rows[0];
}
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {id}=await params,userId=await requireUser();if(!isUuid(id))throw new ApiError(400,'Invalid workout');
 await permission(id,userId);
 const rows=await query<{id:string;itemId:string;status:string;reviewNote:string;createdAt:string;storagePath:string;studentId:string;setIndex:number|null}>(`select v.id,v.assignment_exercise_id as "itemId",v.status,v.review_note as "reviewNote",v.created_at as "createdAt",v.storage_path as "storagePath",a.student_user_id as "studentId",v.set_index as "setIndex" from workout_videos v join assignments a on a.id=v.assignment_id where v.assignment_id=$1 and (v.status!='uploading' or v.uploaded_by=$2) order by v.created_at desc limit 100`,[id,userId]);
 const videos=await Promise.all(rows.rows.map(async row=>({id:row.id,itemId:row.itemId,setIndex:row.setIndex,status:row.status,reviewNote:row.reviewNote,createdAt:row.createdAt,studentId:row.studentId,url:row.status==='uploading'?'':await signedPlaybackUrl(row.storagePath)})));
 return NextResponse.json(videos);
}catch(e){return jsonError(e);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {id}=await params,userId=await requireUser(),b=await request.json();if(!isUuid(id)||!isUuid(b.itemId))throw new ApiError(400,'Invalid workout or exercise');
 const access=await permission(id,userId);if(access.role!=='student')throw new ApiError(403,'Only students can submit videos');
 const ext=validateVideoFile(b.mimeType,b.size),size=Number(b.size);
 const idx=b.setIndex===null||b.setIndex===undefined?null:Number(b.setIndex);
 if(idx!==null&&(!Number.isInteger(idx)||idx<0||idx>29))throw new ApiError(400,'Invalid set index');
 const item=await query<{planned_sets:number}>(`select ae.planned_sets from assignment_exercises ae where ae.id=$1 and ae.assignment_id=$2`,[b.itemId,id]);
 if(!item.rows[0]||(idx!==null&&idx>=item.rows[0].planned_sets))throw new ApiError(404,'Exercise not in workout');
 const count=await query<{count:string}>(`select count(*)::text as count from workout_videos where assignment_id=$1 and uploaded_by=$2 and created_at>now()-interval '1 day'`,[id,userId]);
 if(Number(count.rows[0]?.count||0)>=10)throw new ApiError(429,'Daily video limit reached');
 const videoId=randomUUID(),path=`${access.workspace_id}/${id}/${videoId}.${ext}`;
 const uploadUrl=await signedUploadUrl(path);
 await query(`insert into workout_videos(id,assignment_id,assignment_exercise_id,uploaded_by,storage_path,mime_type,bytes_declared,status,set_index) values($1,$2,$3,$4,$5,$6,$7,'uploading',$8)`,[videoId,id,b.itemId,userId,path,b.mimeType,size,idx]);
 return NextResponse.json({id:videoId,uploadUrl,maxBytes:MAX_VIDEO_BYTES,bucket:VIDEO_BUCKET},{status:201});
}catch(e){return jsonError(e);}}
