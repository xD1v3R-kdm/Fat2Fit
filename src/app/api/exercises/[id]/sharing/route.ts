import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {ApiError,isUuid,requireWorkspace,jsonError} from '@/lib/http';

// Only the exercise's creating coach may publish or withdraw it.
// Publication never changes ownership: records stay in the author's workspace.
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;
  const body=await request.json();
  if(!isUuid(id)||typeof body?.isShared!=='boolean')throw new ApiError(400,'Invalid sharing request');
  const workspaceId=body?.workspaceId;
  const {userId}=await requireWorkspace(workspaceId,['coach']);
  const result=await query<{isShared:boolean}>(`
    update exercises set is_shared=$3
    where id=$1 and workspace_id=$2 and created_by=$4
    returning is_shared as "isShared"`,
    [id,workspaceId,body.isShared,userId]);
  if(!result.rows[0])throw new ApiError(403,'Only your own exercises can be shared');
  return NextResponse.json({ok:true,isShared:result.rows[0].isShared});
 }catch(e){return jsonError(e);}
}
