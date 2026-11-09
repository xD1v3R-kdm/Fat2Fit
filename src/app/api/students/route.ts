import {NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {requireWorkspace,jsonError} from '@/lib/http';
export async function GET(request:Request){try{const ws=new URL(request.url).searchParams.get('workspaceId')||'';await requireWorkspace(ws,['coach']);
const r=await query('select u.id,u.display_name as name,true as joined,m.history_visibility as "historyVisibility" from memberships m join users u on u.id=m.user_id where m.workspace_id=$1 and m.role=$2 order by u.display_name',[ws,'student']);
return NextResponse.json(r.rows);}catch(e){return jsonError(e);}}
