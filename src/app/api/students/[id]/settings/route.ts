import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {ApiError,isUuid,requireWorkspace,jsonError} from '@/lib/http';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;
  const b=await request.json();
  if(!isUuid(id)||!b||typeof b.workspaceId!=='string')throw new ApiError(400,'Invalid request');
  await requireWorkspace(b.workspaceId,['coach']);
  if(!['full','summary'].includes(b.historyVisibility))throw new ApiError(400,'Invalid history setting');
  const r=await query(`update memberships set history_visibility=$1 where workspace_id=$2 and user_id=$3 and role='student' returning user_id`,[b.historyVisibility,b.workspaceId,id]);
  if(!r.rowCount)throw new ApiError(404,'Student not found');
  return NextResponse.json({ok:true,historyVisibility:b.historyVisibility});
 }catch(e){return jsonError(e);}
}
