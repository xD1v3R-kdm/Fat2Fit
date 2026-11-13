import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {ApiError,isUuid,requireWorkspace,jsonError} from '@/lib/http';

export async function POST(request:Request){
 try{
  const b=await request.json();
  const ws=b?.workspaceId;
  await requireWorkspace(ws,['coach']);
  const studentId=b?.studentId,dueOn=b?.dueOn,action=b?.action;
  if(!isUuid(studentId)||typeof dueOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)
    ||!['send','skip'].includes(action))throw new ApiError(400,'Invalid reminder');
  if(Number.isNaN(Date.parse(dueOn))||new Date(dueOn).toISOString().slice(0,10)!==dueOn)
    throw new ApiError(400,'Invalid due date');
  if(action==='skip'){
   const r=await query(`update measurement_requests set status='skipped',skipped_at=now()
    where workspace_id=$1 and student_user_id=$2 and due_on=$3::date and status in ('pending','sent')
    returning due_on`,[ws,studentId,dueOn]);
   if(!r.rowCount)throw new ApiError(409,'Report request not open');
   return NextResponse.json({ok:true,status:'skipped'});
  }
  const token=process.env.TELEGRAM_BOT_TOKEN;
  const bot=process.env.TELEGRAM_BOT_USERNAME;
  const app=process.env.TELEGRAM_MINI_APP_SHORT_NAME;
  if(!token||!bot||!app)throw new ApiError(503,'Telegram bot configuration missing');
  // Claim atomically to prevent duplicate Telegram messages from rapid taps.
  const claimed=await query<{telegramId:string;name:string}>(`update measurement_requests r
   set status='sending' from users u
   where r.student_user_id=u.id and r.workspace_id=$1 and r.student_user_id=$2
     and r.due_on=$3::date and r.status='pending'
   returning u.telegram_id::text as "telegramId",u.display_name as name`,
   [ws,studentId,dueOn]);
  if(!claimed.rows.length)throw new ApiError(409,'Report request already sent or closed');
  const url=`https://t.me/${encodeURIComponent(bot)}/${encodeURIComponent(app)}`;
  try{
   const message=`Fat2Fit 💪\nТренер просит отправить ежемесячный отчёт по замерам тела.\nСрок отчёта: ${dueOn}.\nОткройте «История → Замеры» и сохраните вес, объёмы и другие результаты.\n${url}`;
   const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{
    method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',
    body:JSON.stringify({chat_id:claimed.rows[0].telegramId,text:message,
      reply_markup:{inline_keyboard:[[{text:'Открыть Fat2Fit',url}]]}}),
    signal:AbortSignal.timeout(9000)
   });
   const payload=await response.json() as {ok?:boolean;description?:string};
   if(!response.ok||!payload.ok)throw new Error('Telegram rejected the message');
   await query(`update measurement_requests set status='sent',requested_at=now()
    where workspace_id=$1 and student_user_id=$2 and due_on=$3::date and status='sending'`,
    [ws,studentId,dueOn]);
   return NextResponse.json({ok:true,status:'sent'});
  }catch(e){
   await query(`update measurement_requests set status='pending'
    where workspace_id=$1 and student_user_id=$2 and due_on=$3::date and status='sending'`,
    [ws,studentId,dueOn]);
   throw new ApiError(502,'Telegram could not deliver the request. Make sure the student started the bot.');
  }
 }catch(e){return jsonError(e);}
}
