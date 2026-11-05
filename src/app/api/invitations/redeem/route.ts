import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {transaction} from '@/lib/db';
import {ApiError,requireUser,jsonError} from '@/lib/http';
export async function POST(request:Request){try{
const id=await requireUser();const {token}=await request.json();
if(typeof token!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(token))throw new ApiError(400,'Invalid invitation token');
const hash=createHash('sha256').update(token).digest('hex');
const ws=await transaction(async c=>{
 const r=await c.query<{id:string;workspace_id:string}>('select id,workspace_id from invitations where token_hash=$1 and used_at is null and expires_at>now() for update',[hash]);
 if(!r.rows[0])throw new ApiError(410,'Invitation expired or used');
 const x=r.rows[0];
 await c.query('insert into memberships(workspace_id,user_id,role) values($1,$2,$3) on conflict(workspace_id,user_id) do nothing',[x.workspace_id,id,'student']);
 await c.query('update invitations set used_at=now(), used_by=$1 where id=$2',[id,x.id]);
 return x.workspace_id;
});return NextResponse.json({workspaceId:ws});
}catch(e){return jsonError(e);}}
