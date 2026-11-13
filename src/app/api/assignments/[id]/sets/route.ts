import {NextResponse} from 'next/server';
import {transaction} from '@/lib/db';
import {ApiError,isUuid,requireUser,jsonError,validNumber} from '@/lib/http';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {id}=await params, userId=await requireUser(),b=await request.json();
 if(!isUuid(id)||!isUuid(b.itemId))throw new ApiError(400,'Invalid identifiers');
 const setIndex=validNumber(b.setIndex,0,29),reps=validNumber(b.reps,0,1000),weight=validNumber(b.weight,0,9999),done=Boolean(b.done);
 if(!Number.isInteger(setIndex)||!Number.isInteger(reps))throw new ApiError(400,'Invalid set');
 await transaction(async c=>{
 const r=await c.query<{planned_sets:number;status:string}>(`select ae.planned_sets,a.status from assignment_exercises ae join assignments a on a.id=ae.assignment_id
 join memberships m on m.workspace_id=a.workspace_id and m.user_id=$3
 where ae.id=$1 and ae.assignment_id=$2 and ((m.role='coach' and exists(select 1 from workspaces w where w.id=a.workspace_id and w.owner_user_id=$3)) or (m.role='student' and a.student_user_id=$3)) for update of a`,[b.itemId,id,userId]);
 if(!r.rows[0])throw new ApiError(403,'Assignment not available');
 if(['completed','skipped'].includes(r.rows[0].status))throw new ApiError(409,'Workout is closed');
 if(setIndex>=r.rows[0].planned_sets)throw new ApiError(400,'Set index out of bounds');
 await c.query(`insert into set_logs(assignment_exercise_id,set_index,actual_reps,actual_weight,done,recorded_by) values($1,$2,$3,$4,$5,$6)
 on conflict(assignment_exercise_id,set_index) do update set actual_reps=excluded.actual_reps,actual_weight=excluded.actual_weight,done=excluded.done,recorded_by=excluded.recorded_by,recorded_at=now()`,[b.itemId,setIndex,reps,weight,done,userId]);
 await c.query(`update assignments set status='active',started_at=coalesce(started_at,now()) where id=$1 and status='planned'`,[id]);
 });return NextResponse.json({ok:true});
}catch(e){return jsonError(e);}}
