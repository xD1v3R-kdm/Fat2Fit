import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {ApiError,isUuid,requireUser,jsonError,parseText,validNumber} from '@/lib/http';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
const {id}=await params,userId=await requireUser(),b=await request.json();if(!isUuid(id))throw new ApiError(400,'Invalid assignment');
const effort=validNumber(b.effort??6,1,10),note=parseText(b.note,2000);
const r=await query(`update assignments a set status='completed',note=$3,effort=$4,completed_at=now(),
review_status=case when a.student_user_id=(select owner_user_id from workspaces where id=a.workspace_id) then 'not_required' else 'pending' end
where a.id=$1 and a.status in ('planned','active')
and exists(select 1 from memberships m where m.workspace_id=a.workspace_id and m.user_id=$2 and ((m.role='coach' and exists(select 1 from workspaces w where w.id=a.workspace_id and w.owner_user_id=$2)) or (m.role='student' and a.student_user_id=$2)))
and exists(select 1 from assignment_exercises ae join set_logs l on l.assignment_exercise_id=ae.id where ae.assignment_id=a.id and l.done=true)
returning a.id`,[id,userId,note,effort]);
if(!r.rowCount)throw new ApiError(409,'Workout unavailable or no completed sets');
return NextResponse.json({ok:true});
}catch(e){return jsonError(e);}}
