import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {requireUser,jsonError} from '@/lib/http';
export async function GET(){try{const id=await requireUser();const result=await query<{id:string;name:string;language:'ru'|'en'|'cg';workspace_id:string|null;workspace_name:string|null;role:'coach'|'student'|null;history_visibility:'full'|'summary'}>(`select u.id,u.display_name as name,u.language,w.id as workspace_id,w.name as workspace_name,m.role,m.history_visibility
from users u left join memberships m on m.user_id=u.id left join workspaces w on w.id=m.workspace_id where u.id=$1`,[id]);
const r=result.rows[0];return NextResponse.json({id:r.id,name:r.name,language:r.language,memberships:result.rows.filter(x=>x.workspace_id).map(x=>({workspaceId:x.workspace_id,workspaceName:x.workspace_name,role:x.role,userId:id,historyVisibility:x.history_visibility}))});
}catch(e){return jsonError(e);}}
export async function PATCH(request:Request){try{const id=await requireUser();const {language}=await request.json();if(!['ru','en','cg'].includes(language))return NextResponse.json({error:'Invalid language'},{status:400});await query('update users set language=$1 where id=$2',[language,id]);return NextResponse.json({ok:true});}catch(e){return jsonError(e);}}
