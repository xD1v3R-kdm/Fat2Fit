import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {ApiError,isUuid,requireWorkspace,jsonError} from '@/lib/http';

const bounds = {
 weightKg:[10,500], muscleMassKg:[1,300], waistCm:[20,300], chestCm:[20,300],
 bicepsCm:[10,150], thighCm:[10,200], hipsCm:[20,300]
} as const;

type Measurement = {
 id:string; measuredOn:string; weightKg:number|null; muscleMassKg:number|null; waistCm:number|null;
 chestCm:number|null; bicepsCm:number|null; thighCm:number|null;
 hipsCm:number|null; note:string; updatedAt:string;
};
type Context = {workspaceId:string;studentId:string;userId:string};

async function context(workspaceId:string,requestedStudentId:unknown):Promise<Context>{
 const {userId,role}=await requireWorkspace(workspaceId);
 const studentId=role==='student'?userId:requestedStudentId;
 if(!isUuid(studentId))throw new ApiError(400,'Invalid student');
 if(role==='student'&&requestedStudentId&&requestedStudentId!==userId)throw new ApiError(403,'You can only access your own measurements');
 if(role==='coach'&&studentId!==userId){
   const member=await query('select 1 from memberships where workspace_id=$1 and user_id=$2 and role=$3',[workspaceId,studentId,'student']);
   if(!member.rowCount)throw new ApiError(404,'Student not in this workspace');
 }
 return {workspaceId,studentId,userId};
}

export async function GET(request:Request){
 try{
  const url=new URL(request.url);
  const {workspaceId,studentId}=await context(url.searchParams.get('workspaceId')||'',url.searchParams.get('studentId'));
  const [rows,count,first]=await Promise.all([
   query<Measurement>(`select id,measured_on::text as "measuredOn",
    weight_kg::float8 as "weightKg",muscle_mass_kg::float8 as "muscleMassKg",waist_cm::float8 as "waistCm",
    chest_cm::float8 as "chestCm",biceps_cm::float8 as "bicepsCm",
    thigh_cm::float8 as "thighCm",hips_cm::float8 as "hipsCm",
    note,updated_at::text as "updatedAt"
    from body_measurements where workspace_id=$1 and student_user_id=$2
    order by measured_on desc limit 100`,[workspaceId,studentId]),
   query<{total:number}>(`select count(*)::int as total from assignments
    where workspace_id=$1 and student_user_id=$2 and status='completed'`,[workspaceId,studentId]),
   query<Measurement>(`select id,measured_on::text as "measuredOn",
    weight_kg::float8 as "weightKg",muscle_mass_kg::float8 as "muscleMassKg",waist_cm::float8 as "waistCm",
    chest_cm::float8 as "chestCm",biceps_cm::float8 as "bicepsCm",
    thigh_cm::float8 as "thighCm",hips_cm::float8 as "hipsCm",
    note,updated_at::text as "updatedAt"
    from body_measurements where workspace_id=$1 and student_user_id=$2
    order by measured_on asc,created_at asc limit 1`,[workspaceId,studentId])
  ]);
  return NextResponse.json({measurements:rows.rows,firstMeasurement:first.rows[0]||null,completedWorkouts:count.rows[0]?.total||0},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return jsonError(e);}
}

export async function POST(request:Request){
 try{
  const body=await request.json();
  if(!body||typeof body!=='object')throw new ApiError(400,'Invalid input');
  const {workspaceId,studentId,userId}=await context(body.workspaceId,body.studentId);
  const measuredOn=body.measuredOn;
  if(typeof measuredOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(measuredOn)||Number.isNaN(Date.parse(measuredOn))||
    new Date(measuredOn).toISOString().slice(0,10)!==measuredOn||
    measuredOn>new Date(Date.now()+86400000).toISOString().slice(0,10))
    throw new ApiError(400,'Invalid measurement date');
  const values:Record<keyof typeof bounds,number|null>={weightKg:null,muscleMassKg:null,waistCm:null,chestCm:null,bicepsCm:null,thighCm:null,hipsCm:null};
  let hasValue=false;
  for(const key of Object.keys(bounds) as Array<keyof typeof bounds>){
   const value=body[key];
   if(value===null||value===undefined||value==='')continue;
   if(typeof value!=='number'||!Number.isFinite(value)||value<bounds[key][0]||value>bounds[key][1])
     throw new ApiError(400,`Invalid ${key}`);
   values[key]=Math.round(value*100)/100;
   hasValue=true;
  }
  if(!hasValue)throw new ApiError(400,'Enter at least one body measurement');
  const note=typeof body.note==='string'?body.note.trim():'';
  if(note.length>500)throw new ApiError(400,'Note is too long');
  const r=await query<{id:string}>(`
    insert into body_measurements
     (workspace_id,student_user_id,measured_on,weight_kg,muscle_mass_kg,waist_cm,chest_cm,biceps_cm,thigh_cm,hips_cm,note,recorded_by)
    values ($1,$2,$3::date,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    on conflict (workspace_id,student_user_id,measured_on) do update set
     weight_kg=excluded.weight_kg,muscle_mass_kg=excluded.muscle_mass_kg,waist_cm=excluded.waist_cm,chest_cm=excluded.chest_cm,
     biceps_cm=excluded.biceps_cm,thigh_cm=excluded.thigh_cm,hips_cm=excluded.hips_cm,
     note=excluded.note,recorded_by=excluded.recorded_by,updated_at=now()
    returning id
  `,[workspaceId,studentId,measuredOn,values.weightKg,values.muscleMassKg,values.waistCm,values.chestCm,values.bicepsCm,values.thighCm,values.hipsCm,note,userId]);
  // One saved report resolves at most one open monthly request for this coach.
  await query(`update measurement_requests set status='completed',completed_at=now(),
   completed_measurement_id=$4
   where workspace_id=$1 and student_user_id=$2 and due_on=(
    select max(due_on) from measurement_requests
    where workspace_id=$1 and student_user_id=$2 and due_on<=$3::date
      and status in ('pending','sent'))
   and status in ('pending','sent')`,
   [workspaceId,studentId,measuredOn,r.rows[0].id]);
  return NextResponse.json({ok:true,id:r.rows[0].id},{status:201});
 }catch(e){return jsonError(e);}
}
