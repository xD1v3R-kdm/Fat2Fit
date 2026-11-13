import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {ApiError,requireWorkspace,jsonError} from '@/lib/http';
import {reportingPeriods} from '@/lib/report-schedule';

type Member={id:string;name:string;telegramId:string;joinedOn:string};
type Reminder={studentId:string;studentName:string;dueOn:string;status:'pending'|'sent'};

export async function GET(request:Request){
 try{
  const u=new URL(request.url);
  const ws=u.searchParams.get('workspaceId')||'';
  const {userId}=await requireWorkspace(ws,['coach']);
  const date=u.searchParams.get('date')||new Date().toISOString().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||
   new Date(date).toISOString().slice(0,10)!==date)throw new ApiError(400,'Invalid date');
  // The owner check in requireWorkspace prevents another coach seeing the queue.
  const [stats,members]=await Promise.all([
   query<{today:number;tomorrow:number;workoutsPending:number;videosPending:number}>(`
     select
      (select count(*)::int from assignments where workspace_id=$1 and scheduled_on=$2::date) as today,
      (select count(*)::int from assignments where workspace_id=$1 and scheduled_on=$2::date+1) as tomorrow,
      (select count(*)::int from assignments where workspace_id=$1 and status='completed' and review_status='pending') as "workoutsPending",
      (select count(*)::int from workout_videos v join assignments a on a.id=v.assignment_id
       where a.workspace_id=$1 and v.status='pending') as "videosPending"`,[ws,date]),
   query<Member>(`select u.id,u.display_name as name,u.telegram_id::text as "telegramId",
     (m.created_at at time zone 'Europe/Podgorica')::date::text as "joinedOn"
     from memberships m join users u on u.id=m.user_id
     where m.workspace_id=$1 and m.role='student' order by m.created_at`,[ws])
  ]);
  // Materialize each calendar-month reminder idempotently on trainer dashboard open.
  // Students who already submitted measurements during the cycle are not nagged.
  for(const member of members.rows){
   const periods=reportingPeriods(member.joinedOn,date);
   if(!periods.length)continue;
   await query(`insert into measurement_requests
      (workspace_id,student_user_id,due_on,status,completed_measurement_id,completed_at)
      select $1,$2,cycle.due_on,
        case when bm.id is null then 'pending' else 'completed' end,
        bm.id,case when bm.id is null then null else now() end
      from unnest($3::date[],$4::date[]) cycle(due_on,period_start)
      left join lateral (
       select id from body_measurements
       where workspace_id=$1 and student_user_id=$2
         and measured_on>cycle.period_start
         and measured_on<=cycle.due_on
       order by measured_on desc,created_at desc limit 1
      ) bm on true
      on conflict(workspace_id,student_user_id,due_on) do nothing`,
    [ws,member.id,periods.map(x=>x.dueOn),periods.map(x=>x.periodStart)]);
  }
  const reminders=await query<Reminder>(`select r.student_user_id as "studentId",
    u.display_name as "studentName",r.due_on::text as "dueOn",r.status
    from measurement_requests r join users u on u.id=r.student_user_id
    where r.workspace_id=$1 and r.due_on<=$2::date and r.status in ('pending','sent')
    order by r.due_on,u.display_name limit 50`,[ws,date]);
  return NextResponse.json({...(stats.rows[0]||{today:0,tomorrow:0,workoutsPending:0,videosPending:0}),
   reminders:reminders.rows,coachUserId:userId},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return jsonError(e);}
}
