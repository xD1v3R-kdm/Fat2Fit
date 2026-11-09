import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {ApiError,isUuid,requireWorkspace,jsonError} from '@/lib/http';
export async function GET(request:Request){
 try{
  const u=new URL(request.url);
  const ws=u.searchParams.get('workspaceId')||'';
  const {userId,role}=await requireWorkspace(ws);
  const requested=u.searchParams.get('studentId');
  const studentId=role==='coach'?(requested||userId):userId;
  if(!isUuid(studentId))throw new ApiError(400,'Invalid student ID');
  if(role==='coach'&&studentId!==userId){
   const membership=await query("select 1 from memberships where workspace_id=$1 and user_id=$2 and role='student'",[ws,studentId]);
   if(!membership.rowCount)throw new ApiError(404,'Student not found');
  }
  const [counts,permission]=await Promise.all([
   query<{workoutType:string;count:number}>(`select workout_type as "workoutType",count(*)::int as count
    from assignments where workspace_id=$1 and student_user_id=$2 and status='completed'
    group by workout_type`,[ws,studentId]),
   query<{history_visibility:'full'|'summary'}>("select history_visibility from memberships where workspace_id=$1 and user_id=$2",[ws,studentId])
  ]);
  const totals={strength:0,circuit:0,cardio:0};
  for(const row of counts.rows)if(row.workoutType in totals)totals[row.workoutType as keyof typeof totals]=row.count;
  return NextResponse.json({counts:totals,total:Object.values(totals).reduce((a,b)=>a+b,0),
    historyVisibility:role==='coach'&&studentId===userId?'full':permission.rows[0]?.history_visibility||'full'},
    {headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return jsonError(e);}
}
