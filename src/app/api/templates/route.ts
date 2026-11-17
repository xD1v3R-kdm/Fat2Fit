import {NextResponse} from 'next/server';
import {query,transaction} from '@/lib/db';
import {ApiError,isUuid,validNumber,validTitle,requireWorkspace,jsonError} from '@/lib/http';
export async function GET(request:Request){try{const ws=new URL(request.url).searchParams.get('workspaceId')||'';await requireWorkspace(ws);
const r=await query<{id:string;workspaceId:string;title:Record<string,string>;workoutType:string}>('select id,workspace_id as "workspaceId",title,workout_type as "workoutType" from workout_templates where workspace_id=$1 order by created_at desc',[ws]);
const ids=r.rows.map(x=>x.id);
const items=ids.length?await query<{id:string;templateId:string;exerciseId:string;sets:number;reps:number;weight:string;rest:number}>(`select id,template_id as "templateId",exercise_id as "exerciseId",planned_sets as sets,planned_reps as reps,planned_weight as weight,rest_seconds as rest from template_exercises where template_id=any($1::uuid[]) order by position`,[ids]):{rows:[]};
return NextResponse.json(r.rows.map(t=>({...t,items:items.rows.filter(i=>i.templateId===t.id).map(i=>({...i,weight:Number(i.weight)}))})));
}catch(e){return jsonError(e);}}
export async function POST(request:Request){try{const b=await request.json();const ws=b.workspaceId,{userId}=await requireWorkspace(ws,['coach']);
const title=validTitle(b.title);
if(!['strength','circuit','cardio'].includes(b.workoutType))throw new ApiError(400,'Invalid workout category');
if(!Array.isArray(b.items)||b.items.length>30)throw new ApiError(400,'Invalid template exercises');
const rows=b.items.map((i:Record<string,unknown>)=>{if(!isUuid(i.exerciseId))throw new ApiError(400,'Invalid exercise');return {exerciseId:i.exerciseId,sets:validNumber(i.sets,1,30),reps:validNumber(i.reps,1,1000),weight:validNumber(i.weight,0,9999),rest:validNumber(i.rest,0,3600)};});
const result=await transaction(async c=>{
 for(const i of rows){const allowed=await c.query('select 1 from exercises where id=$1 and (workspace_id is null or workspace_id=$2 or is_shared=true
      or exists(select 1 from template_exercises te join workout_templates wt on wt.id=te.template_id
           where te.exercise_id=exercises.id and wt.workspace_id=$2)
      or exists(select 1 from assignment_exercises ae join assignments a on a.id=ae.assignment_id
           where ae.exercise_id=exercises.id and a.workspace_id=$2))',[i.exerciseId,ws]);if(!allowed.rowCount)throw new ApiError(403,'Exercise unavailable');}
 const t=await c.query<{id:string}>('insert into workout_templates(workspace_id,title,created_by,workout_type) values($1,$2::jsonb,$3,$4) returning id',[ws,JSON.stringify(title),userId,b.workoutType]);
 for(let n=0;n<rows.length;n++){const i=rows[n];await c.query('insert into template_exercises(template_id,exercise_id,position,planned_sets,planned_reps,planned_weight,rest_seconds) values($1,$2,$3,$4,$5,$6,$7)',[t.rows[0].id,i.exerciseId,n,i.sets,i.reps,i.weight,i.rest]);}
 return t.rows[0].id;});return NextResponse.json({id:result},{status:201});
}catch(e){return jsonError(e);}}
