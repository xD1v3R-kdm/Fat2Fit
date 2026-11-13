import {NextResponse} from 'next/server';
import {query,transaction} from '@/lib/db';
import {ApiError,isUuid,requireWorkspace,jsonError} from '@/lib/http';
export async function GET(request:Request){try{const ws=new URL(request.url).searchParams.get('workspaceId')||'';
const {userId,role}=await requireWorkspace(ws);
const visibility=role==='student'?await query<{history_visibility:string}>('select history_visibility from memberships where workspace_id=$1 and user_id=$2',[ws,userId]):null;
const summaryOnly=role==='student'&&visibility?.rows[0]?.history_visibility==='summary';
const assignments=await query<{id:string;workspaceId:string;studentId:string;templateId:string|null;title:Record<string,string>;date:string;status:'planned'|'active'|'completed'|'skipped';note:string;effort:number;workoutType:string}>(`select id,workspace_id as "workspaceId",student_user_id as "studentId",template_id as "templateId",title,scheduled_on::text as date,status,note,coalesce(effort,6) as effort,workout_type as "workoutType",review_status as "reviewStatus",review_note as "reviewNote" from assignments where workspace_id=$1 and ($2='coach' or student_user_id=$3) and ($4=false or status not in ('completed','skipped')) order by scheduled_on desc,created_at desc`,[ws,role,userId,summaryOnly]);
const ids=assignments.rows.map(x=>x.id);
const items=ids.length?await query<{id:string;assignmentId:string;exerciseId:string;sets:number;reps:number;weight:string;rest:number}>(`select id,assignment_id as "assignmentId",exercise_id as "exerciseId",planned_sets as sets,planned_reps as reps,planned_weight as weight,rest_seconds as rest from assignment_exercises where assignment_id=any($1::uuid[]) order by position`,[ids]):{rows:[]};
const videoCounts=ids.length?await query<{assignmentId:string;pendingVideos:number}>(`select assignment_id as "assignmentId",count(*)::integer as "pendingVideos" from workout_videos where assignment_id=any($1::uuid[]) and status='pending' group by assignment_id`,[ids]):{rows:[]};
const itemIds=items.rows.map(i=>i.id);
const logs=itemIds.length?await query<{itemId:string;setIndex:number;reps:number;weight:string;done:boolean}>(`select assignment_exercise_id as "itemId",set_index as "setIndex",actual_reps as reps,actual_weight as weight,done,recorded_by as "recordedBy" from set_logs where assignment_exercise_id=any($1::uuid[])`,[itemIds]):{rows:[]};
return NextResponse.json(assignments.rows.map(a=>({...a,pendingVideos:videoCounts.rows.find(v=>v.assignmentId===a.id)?.pendingVideos||0,items:items.rows.filter(i=>i.assignmentId===a.id).map(i=>({...i,weight:Number(i.weight),logs:logs.rows.filter(l=>l.itemId===i.id).map(l=>({...l,weight:Number(l.weight)}))}))})));
}catch(e){return jsonError(e);}}
export async function POST(request:Request){
 try{
  const b=await request.json();
  const ws=b?.workspaceId;
  const {userId}=await requireWorkspace(ws,['coach']);
  const studentId=b?.studentId;
  if(!isUuid(studentId)||typeof b.date!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(b.date)
     ||!Number.isFinite(Date.parse(b.date))||new Date(b.date).toISOString().slice(0,10)!==b.date)throw new ApiError(400,'Invalid assignment');
  const manual=b.source==='manual';
  if(manual&&b.templateId)throw new ApiError(400,'Choose template or individual exercises');
  if(!manual&&!isUuid(b.templateId))throw new ApiError(400,'Invalid template');
  const type=b.workoutType;
  if(manual&&!['strength','circuit','cardio'].includes(type))throw new ApiError(400,'Invalid category');
  const name=manual?b.title:null;
  if(manual&&(typeof name!=='object'||!name||!Object.values(name).some(x=>typeof x==='string'&&x.trim())))throw new ApiError(400,'Workout title required');
  const title:Record<string,string>={};
  if(manual)for(const lang of ['ru','en','cg']){
   const v=name[lang];if(v!==undefined&&v!==null){if(typeof v!=='string'||v.trim().length>120)throw new ApiError(400,'Invalid workout title');if(v.trim())title[lang]=v.trim();}
  }
  if(manual&&!Object.keys(title).length)throw new ApiError(400,'Workout title required');
  if(manual&&(!Array.isArray(b.items)||b.items.length<1||b.items.length>30))throw new ApiError(400,'Workout needs 1–30 exercises');
  const rows=manual?b.items.map((x:Record<string,unknown>,position:number)=>{
   if(!isUuid(x.exerciseId))throw new ApiError(400,'Invalid exercise ID');
   const sets=Number(x.sets),reps=Number(x.reps),weight=Number(x.weight),rest=Number(x.rest);
   if(!Number.isInteger(sets)||sets<1||sets>30||!Number.isInteger(reps)||reps<1||reps>1000
    ||!Number.isFinite(weight)||weight<0||weight>9999||!Number.isInteger(rest)||rest<0||rest>3600)
     throw new ApiError(400,'Invalid exercise values');
   return {exerciseId:x.exerciseId,position,sets,reps,weight,rest};
  }):[];
  const id=await transaction(async c=>{
   const sm=await c.query("select 1 from memberships where workspace_id=$1 and user_id=$2 and (role='student' or (role='coach' and user_id=$3 and exists(select 1 from workspaces where id=$1 and owner_user_id=$3)))",[ws,studentId,userId]);
   if(!sm.rowCount)throw new ApiError(403,'Student not in workspace');
   let finalItems:{exerciseId:string;position:number;sets:number;reps:number;weight:number;rest:number}[];
   let finalTitle:Record<string,string>,workoutType:string,templateId:string|null=null;
   if(manual){
    finalTitle=title;workoutType=type;
    finalItems=rows;
    for(const item of rows){
     const allowed=await c.query("select 1 from exercises where id=$1 and (workspace_id is null or workspace_id=$2)",[item.exerciseId,ws]);
     if(!allowed.rowCount)throw new ApiError(403,'Exercise unavailable');
    }
   }else{
    const t=await c.query<{id:string;title:Record<string,string>;workout_type:string}>(
     'select id,title,workout_type from workout_templates where id=$1 and workspace_id=$2',[b.templateId,ws]);
    if(!t.rows[0])throw new ApiError(404,'Template not found');
    templateId=t.rows[0].id;finalTitle=t.rows[0].title;workoutType=t.rows[0].workout_type;
    const tItems=await c.query<{exercise_id:string;position:number;planned_sets:number;planned_reps:number;planned_weight:string;rest_seconds:number}>(
     'select * from template_exercises where template_id=$1 order by position',[templateId]);
    if(!tItems.rows.length)throw new ApiError(400,'Template has no exercises');
    finalItems=tItems.rows.map(x=>({exerciseId:x.exercise_id,position:x.position,sets:x.planned_sets,reps:x.planned_reps,weight:Number(x.planned_weight),rest:x.rest_seconds}));
   }
   const created=await c.query<{id:string}>(`insert into assignments(workspace_id,student_user_id,template_id,title,scheduled_on,workout_type)
    values($1,$2,$3,$4::jsonb,$5::date,$6) returning id`,[ws,studentId,templateId,JSON.stringify(finalTitle),b.date,workoutType]);
   for(const item of finalItems)await c.query(
    'insert into assignment_exercises(assignment_id,exercise_id,position,planned_sets,planned_reps,planned_weight,rest_seconds) values($1,$2,$3,$4,$5,$6,$7)',
    [created.rows[0].id,item.exerciseId,item.position,item.sets,item.reps,item.weight,item.rest]);
   return created.rows[0].id;
  });
  return NextResponse.json({id},{status:201});
 }catch(e){return jsonError(e);}
}
