import {NextResponse} from 'next/server';
import {transaction} from '@/lib/db';
import {ApiError,isUuid,validNumber,validTitle,requireWorkspace,jsonError} from '@/lib/http';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {id}=await params,b=await request.json();if(!isUuid(id))throw new ApiError(400,'Invalid template');
 const ws=b.workspaceId;await requireWorkspace(ws,['coach']);const title=validTitle(b.title);
 if(!['strength','circuit','cardio'].includes(b.workoutType))throw new ApiError(400,'Invalid workout category');
 if(!Array.isArray(b.items)||b.items.length>30)throw new ApiError(400,'Invalid template');
 const items=b.items.map((i:Record<string,unknown>)=>{
  if(!isUuid(i.exerciseId))throw new ApiError(400,'Invalid exercise');
  return {exerciseId:i.exerciseId,sets:validNumber(i.sets,1,30),reps:validNumber(i.reps,1,1000),weight:validNumber(i.weight,0,9999),rest:validNumber(i.rest,0,3600)};
 });
 await transaction(async c=>{
  const t=await c.query('select id from workout_templates where id=$1 and workspace_id=$2 for update',[id,ws]);if(!t.rowCount)throw new ApiError(404,'Template not found');
  for(const item of items){const ok=await c.query('select 1 from exercises where id=$1 and (workspace_id is null or workspace_id=$2 or is_shared=true
      or exists(select 1 from template_exercises te join workout_templates wt on wt.id=te.template_id
           where te.exercise_id=exercises.id and wt.workspace_id=$2)
      or exists(select 1 from assignment_exercises ae join assignments a on a.id=ae.assignment_id
           where ae.exercise_id=exercises.id and a.workspace_id=$2))',[item.exerciseId,ws]);if(!ok.rowCount)throw new ApiError(403,'Exercise unavailable');}
  await c.query('update workout_templates set title=$1::jsonb,workout_type=$3 where id=$2',[JSON.stringify(title),id,b.workoutType]);
  await c.query('delete from template_exercises where template_id=$1',[id]);
  for(let n=0;n<items.length;n++){const x=items[n];await c.query('insert into template_exercises(template_id,exercise_id,position,planned_sets,planned_reps,planned_weight,rest_seconds) values($1,$2,$3,$4,$5,$6,$7)',[id,x.exerciseId,n,x.sets,x.reps,x.weight,x.rest]);}
 });return NextResponse.json({ok:true});
}catch(e){return jsonError(e);}}
