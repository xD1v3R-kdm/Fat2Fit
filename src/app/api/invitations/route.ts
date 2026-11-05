import {NextResponse} from 'next/server';
import {randomBytes,createHash} from 'node:crypto';
import {query} from '@/lib/db';
import {requireWorkspace,jsonError} from '@/lib/http';
export async function POST(request:Request){try{
 const b=await request.json();const ws=b.workspaceId,{userId}=await requireWorkspace(ws,['coach']);
 const token=randomBytes(24).toString('base64url');const hash=createHash('sha256').update(token).digest('hex');
 await query('insert into invitations(workspace_id,token_hash,created_by,expires_at) values($1,$2,$3,now()+interval \'7 days\')',[ws,hash,userId]);
 const bot=process.env.TELEGRAM_BOT_USERNAME,app=process.env.TELEGRAM_MINI_APP_SHORT_NAME;
 const link=bot&&app?`https://t.me/${encodeURIComponent(bot)}/${encodeURIComponent(app)}?startapp=invite_${token}`:`${process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000'}/?invite=${token}`;
 return NextResponse.json({link,expiresInDays:7},{status:201});
}catch(e){return jsonError(e);}}
