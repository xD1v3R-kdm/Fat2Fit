import {NextResponse} from 'next/server';
import {currentUserId} from './session';
import {query} from './db';
import type {Role} from './types';
export class ApiError extends Error {constructor(public status:number,message:string){super(message);}}
export function jsonError(e:unknown){if(e instanceof ApiError)return NextResponse.json({error:e.message},{status:e.status});console.error('Fat2Fit API:',e);return NextResponse.json({error:'Server error'},{status:500});}
export async function requireUser(){const userId=await currentUserId();if(!userId)throw new ApiError(401,'Login through Telegram');return userId;}
export async function requireWorkspace(workspaceId:string,allowed:Role[]=['coach','student']){
 const userId=await requireUser();if(!isUuid(workspaceId))throw new ApiError(400,'Invalid workspace');
 const m=await query<{role:Role;owner_user_id:string}>(`select m.role,w.owner_user_id from memberships m
 join workspaces w on w.id=m.workspace_id where m.workspace_id=$1 and m.user_id=$2`,[workspaceId,userId]);
 if(!m.rows[0]||!allowed.includes(m.rows[0].role)||
  (m.rows[0].role==='coach'&&m.rows[0].owner_user_id!==userId))
  throw new ApiError(403,'Workspace access denied');
 return {userId,role:m.rows[0].role};
}
export function isUuid(x:unknown):x is string{return typeof x==='string' && /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(x);}
export function parseText(x:unknown,max=200){return typeof x==='string'?x.trim().slice(0,max):'';}
export function validUrl(x:unknown){if(x===null||x===undefined||x==='')return '';if(typeof x!=='string'||x.length>2048)throw new ApiError(400,'Invalid media URL');try{const u=new URL(x);if(u.protocol!=='https:')throw Error();return u.toString();}catch{throw new ApiError(400,'Media URL must be HTTPS');}}
export function validNumber(x:unknown,min:number,max:number){const v=Number(x);if(!Number.isFinite(v)||v<min||v>max)throw new ApiError(400,'Invalid numeric field');return v;}
export function validTitle(x:unknown){if(!x||typeof x!=='object')throw new ApiError(400,'Missing title');const out:Record<string,string>={};for(const lang of ['ru','en','cg']){const v=parseText((x as Record<string,unknown>)[lang],120);if(v)out[lang]=v;}if(!Object.keys(out).length)throw new ApiError(400,'Missing title');return out;}
