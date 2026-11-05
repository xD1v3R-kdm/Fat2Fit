import {NextResponse} from 'next/server';
import {validateTelegramInitData} from '@/lib/telegram';
import {transaction,query} from '@/lib/db';
import {setSession} from '@/lib/session';
import {jsonError,ApiError} from '@/lib/http';
export async function POST(request:Request){
 try{
  const body=await request.json();const raw=body?.initData;
  if(typeof raw!=='string')throw new ApiError(400,'Missing initData');
  const u=validateTelegramInitData(raw,process.env.TELEGRAM_BOT_TOKEN||'');
  const name=[u.first_name,u.last_name].filter(Boolean).join(' ').trim().slice(0,120)||'Telegram user';
  const language=['ru','en','sr'].includes((u.language_code||'').slice(0,2)) ? (u.language_code||'').slice(0,2) : 'en';
  const created=await query<{id:string}>('insert into users(telegram_id,display_name,language) values ($1,$2,$3) on conflict(telegram_id) do update set display_name=excluded.display_name returning id',[u.id,name,language]);
  const userId=created.rows[0].id;
  const coaches=(process.env.BOOTSTRAP_COACH_TELEGRAM_IDS||'').split(',').map(v=>v.trim());
  if(coaches.includes(String(u.id))){
   await transaction(async c=>{
    await c.query('select pg_advisory_xact_lock(hashtext($1))',[userId]);
    const existing=await c.query('select 1 from memberships where user_id=$1 and role=$2 limit 1',[userId,'coach']);
    if(!existing.rowCount){
     const w=await c.query<{id:string}>('insert into workspaces(name) values($1) returning id',[`${name} · Fat2Fit`]);
     await c.query('insert into memberships(workspace_id,user_id,role) values($1,$2,$3)',[w.rows[0].id,userId,'coach']);
    }
   });
  }
  await setSession(userId);
  return NextResponse.json({ok:true});
 }catch(e){return jsonError(e);}
}
