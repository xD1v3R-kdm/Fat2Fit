import type {Assignment,Exercise,Student,WorkoutTemplate,Language,Localized} from './types';
export type DemoData={exercises:Exercise[];templates:WorkoutTemplate[];students:Student[];assignments:Assignment[]};
const txt=(ru:string,en:string,cg:string,description='')=>({ru:{name:ru,description,coachTips:'',faq:description},en:{name:en,description,coachTips:'',faq:description},cg:{name:cg,description,coachTips:'',faq:description}});
export const demoExercises:Exercise[]=[
{id:'bench',workspaceId:null,group:'chest',equipment:'Штанга · скамья',photoUrl:'https://images.pexels.com/photos/4553611/pexels-photo-4553611.jpeg?auto=compress&cs=tinysrgb&w=700',videoUrl:'https://www.youtube.com/watch?v=hWbUlkb5Ms4',translations:{ru:{name:'Жим штанги лёжа',description:'Сведите лопатки, устойчиво поставьте стопы. Контролируемо опускайте штангу к нижней части груди.',faq:'Не отрывайте таз от скамьи. Не бросайте штангу на грудь.'},en:{name:'Barbell bench press',description:'Retract your shoulder blades and plant your feet. Lower the bar with control.',faq:'Avoid lifting your hips or bouncing the bar.'},cg:{name:'Potisak sa klupe',description:'Spojite lopatice i čvrsto postavite stopala. Kontrolisano spuštajte šipku.',faq:'Ne podižite kukove sa klupe.'}}},
{id:'incline',workspaceId:null,group:'chest',equipment:'Гантели',photoUrl:'https://images.pexels.com/photos/7289245/pexels-photo-7289245.jpeg?auto=compress&cs=tinysrgb&w=700',videoUrl:'',translations:txt('Жим гантелей под углом','Incline dumbbell press','Kosi potisak bučicama','Держите скамью под углом около 30 градусов.')},
{id:'pull',workspaceId:null,group:'back',equipment:'Тренажёр',photoUrl:'',videoUrl:'',translations:txt('Тяга верхнего блока','Lat pulldown','Povlačenje na lat mašini','Тяните рукоять к верхней части груди плавно, без рывков.')},
{id:'squat',workspaceId:null,group:'legs',equipment:'Штанга',photoUrl:'',videoUrl:'',translations:txt('Приседания со штангой','Barbell squat','Čučanj sa šipkom','Сохраняйте стабильный корпус и контролируйте глубину приседа.')},
{id:'leg',workspaceId:null,group:'legs',equipment:'Тренажёр',photoUrl:'',videoUrl:'',translations:txt('Жим ногами','Leg press','Nožni potisak','Не отрывайте поясницу от спинки тренажёра.')},
{id:'plank',workspaceId:null,group:'core',equipment:'Коврик',photoUrl:'',videoUrl:'https://www.youtube.com/watch?v=kSNboUqHmhU',translations:txt('Планка','Plank','Plank','Держите корпус ровным и дышите равномерно.')}
];
const titles=(ru:string,en:string,cg:string):Localized=>({ru,en,cg});
export const demoTemplates:WorkoutTemplate[]=[
{id:'push',workspaceId:'demo-workspace',workoutType:'strength',title:titles('Верх тела · A','Upper body · A','Gornji deo · A'),items:[{id:'pi1',exerciseId:'bench',sets:3,reps:10,weight:50,rest:90},{id:'pi2',exerciseId:'incline',sets:3,reps:12,weight:16,rest:75},{id:'pi3',exerciseId:'pull',sets:3,reps:12,weight:35,rest:90}]},
{id:'legs',workspaceId:'demo-workspace',workoutType:'strength',title:titles('Ноги · B','Leg day · B','Noge · B'),items:[{id:'li1',exerciseId:'squat',sets:3,reps:8,weight:40,rest:120},{id:'li2',exerciseId:'leg',sets:3,reps:12,weight:70,rest:90},{id:'li3',exerciseId:'plank',sets:3,reps:45,weight:0,rest:45}]}
];
export const demoStudents:Student[]=[{id:'anna',name:'Анна',joined:true,historyVisibility:'full'},{id:'max',name:'Максим',joined:true,historyVisibility:'full'},{id:'igor',name:'Игорь',joined:true,historyVisibility:'full'}];
export function dateShift(n=0){const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function snap(t:WorkoutTemplate){return t.items.map(i=>({...i,id:`${t.id}-${i.id}-${Math.random().toString(36).slice(2,6)}`,logs:[]}));}
export function seedDemo():DemoData{return {exercises:structuredClone(demoExercises),templates:structuredClone(demoTemplates),students:structuredClone(demoStudents),assignments:[
{id:'demo-a1',workspaceId:'demo-workspace',studentId:'anna',templateId:'push',title:demoTemplates[0].title,workoutType:'strength',date:dateShift(),status:'planned',items:snap(demoTemplates[0]),note:'',effort:6},
{id:'demo-a2',workspaceId:'demo-workspace',studentId:'max',templateId:'legs',title:demoTemplates[1].title,workoutType:'strength',date:dateShift(1),status:'planned',items:snap(demoTemplates[1]),note:'',effort:6},
{id:'demo-a3',workspaceId:'demo-workspace',studentId:'igor',templateId:'push',title:demoTemplates[0].title,workoutType:'strength',date:dateShift(-3),status:'completed',items:snap(demoTemplates[0]).map(i=>({...i,logs:Array.from({length:i.sets},(_,j)=>({setIndex:j,reps:i.reps,weight:i.weight,done:true}))})),note:'Хорошая тренировка',effort:7}
]};}
export const demoWorkspaceId='demo-workspace';
export const isLang=(s:string):s is Language=>['ru','en','cg'].includes(s);
