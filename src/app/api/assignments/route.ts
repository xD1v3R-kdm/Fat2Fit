import {NextResponse} from 'next/server';
import {query,transaction} from '@/lib/db';
import {ApiError,isUuid,requireWorkspace,jsonError} from '@/lib/http';
export async function GET(request:Request){try{const ws=new URL(request.url).searchParams.get('workspaceId')||'';
const {userId,role}=await requireWorkspace(ws);
const visibility=role==='student'?await query<{history_visibility:string}>('select history_visibility from memberships where workspace_id=$1 and user_id=$2',[ws,userId]):null;
const summaryOnly=role==='student'&&visibility?.rows[0]?.history_visibility==='summary';
const assignments=await query<{id:string;workspaceId:string;studentId:string;templateId:string|null;title:Record<string,string>;date:string;status:'planned'|'active'|'completed'|'skipped';note:string;effort:number;workoutType:string}>(`select id,workspace_id as "workspaceId",student_user_id as "studentId",template_id as "templateId",title,scheduled_on::text as date,status,note,coalesce(effort,6) as effort,workout_type as "workoutType" from assignments where workspace_id=$1 and ($2='coach' or student_user_id=$3) and ($4=false or status not in ('completed','skipped')) order by scheduled_on desc,created_at desc`,[ws,role,userId,summaryOnly]);
const ids=assignments.rows.map(x=>x.id);
const items=ids.length?await query<{id:string;assignmentId:string;exerciseId:string;sets:number;reps:number;weight:string;rest:number}>(`select id,assignment_id as "assignmentId",exercise_id as "exerciseId",planned_sets as sets,planned_reps as reps,planned_weight as weight,rest_seconds as rest from assignment_exercises where assignment_id=any($1::uuid[]) order by position`,[ids]):{rows:[]};
const videoCounts=ids.length?await query<{assignmentId:string;pendingVideos:number}>(`select assignment_id as "assignmentId",count(*)::integer as "pendingVideos" from workout_videos where assignment_id=any($1::uuid[]) and status='pending' group by assignment_id`,[ids]):{rows:[]};
const itemIds=items.rows.map(i=>i.id);
const logs=itemIds.length?await query<{itemId:string;setIndex:number;reps:number;weight:string;done:boolean}>(`select assignment_exercise_id as "itemId",set_index as "setIndex",actual_reps as reps,actual_weight as weight,done,recorded_by as "recordedBy" from set_logs where assignment_exercise_id=any($1::uuid[])`,[itemIds]):{rows:[]};
return NextResponse.json(assignments.rows.map(a=>({...a,pendingVideos:videoCounts.rows.find(v=>v.assignmentId===a.id)?.pendingVideos||0,items:items.rows.filter(i=>i.assignmentId===a.id).map(i=>({...i,weight:Number(i.weight),logs:logs.rows.filter(l=>l.itemId===i.id).map(l=>({...l,weight:Number(l.weight)}))}))})));
}catch(e){return jsonError(e);}}
export async function POST(request:Request){try{
const b=await request.json(),ws=b.workspaceId;
const {userId}=await requireWorkspace(ws,['coach']);if(!isUuid(b.studentId)||!isUuid(b.templateId)||typeof b.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.date))throw new ApiError(400,'Invalid assignment');
const id=await transaction(async c=>{
 const sm=await c.query('select 1 from memberships where workspace_id=$1 and user_id=$2 and (role=$3 or ($2=$4 and role='coach'))',[ws,b.studentId,'student',userId]);
 if(!sm.rowCount)throw new ApiError(403,'Student not in workspace');
 const tm=await c.query<{id:string;title:Record<string,string>;workout_type:string}>('select id,title,workout_type from workout_templates where id=$1 and workspace_id=$2',[b.templateId,ws]);
 if(!tm.rows[0])throw new ApiError(404,'Template not found');
 const items=await c.query<{exercise_id:string;position:number;planned_sets:number;planned_reps:number;planned_weight:number;rest_seconds:number}>('select * from template_exercises where template_id=$1 order by position',[b.templateId]);
 if(!items.rows.length)throw new ApiError(400,'Template has no exercises');
 const r=await c.query<{id:string}>('insert into assignments(workspace_id,student_user_id,template_id,title,scheduled_on,workout_type) values($1,$2,$3,$4::jsonb,$5::date,$6) returning id',[ws,b.studentId,b.templateId,JSON.stringify(tm.rows[0].title),b.date,tm.rows[0].workout_type]);
 for(const item of items.rows)await c.query('insert into assignment_exercises(assignment_id,exercise_id,position,planned_sets,planned_reps,planned_weight,rest_seconds) values($1,$2,$3,$4,$5,$6,$7)',[r.rows[0].id,item.exercise_id,item.position,item.planned_sets,item.planned_reps,item.planned_weight,item.rest_seconds]);
 return r.rows[0].id;
});return NextResponse.json({id},{status:201});
}catch(e){return jsonError(e);}}
