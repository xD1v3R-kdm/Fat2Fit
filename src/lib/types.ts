export type Language = 'ru' | 'en' | 'cg';
export type Role = 'coach' | 'student';
export type WorkoutType = 'strength' | 'circuit' | 'cardio';
export type HistoryVisibility = 'full' | 'summary';
export type Localized = Partial<Record<Language,string>>;
export type Exercise = {
  id:string; workspaceId:string|null; group:string; equipment:string;
  photoUrl:string; videoUrl:string; translations:Record<string,{name:string;description:string;faq:string}>;customized?:boolean;
};
export type WorkoutItem = { id:string; exerciseId:string; sets:number; reps:number; weight:number; rest:number; };
export type WorkoutTemplate = {id:string;workspaceId:string;title:Localized;items:WorkoutItem[];workoutType:WorkoutType};
export type SetLog = {setIndex:number;reps:number;weight:number;done:boolean;recordedBy?:string|null};
export type AssignmentItem = WorkoutItem & {logs:SetLog[]};
export type Assignment = {id:string;workspaceId:string;studentId:string;templateId:string|null;title:Localized;date:string;status:'planned'|'active'|'completed'|'skipped';items:AssignmentItem[];note:string;effort:number;pendingVideos?:number;workoutType:WorkoutType};
export type Student = {id:string;name:string; joined:boolean;historyVisibility:HistoryVisibility};
export type Membership = {workspaceId:string;workspaceName:string;role:Role;userId:string;historyVisibility?:HistoryVisibility};
export type Me = {id:string;name:string;language:Language;memberships:Membership[]};
