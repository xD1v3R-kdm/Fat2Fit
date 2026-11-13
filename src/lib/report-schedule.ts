// Calendar-month cadence anchored to the coach/student connection date.
// All dates are local calendar ISO YYYY-MM-DD strings (no 30-day approximations).
const ISO=/^\d{4}-\d{2}-\d{2}$/;
export function monthlyDueDate(joined:string,monthIndex:number):string{
 if(!ISO.test(joined)||!Number.isInteger(monthIndex)||monthIndex<0)throw Error('Invalid reporting period');
 const [year,month,day]=joined.split('-').map(Number);
 const anchor=new Date(Date.UTC(year,month-1,day));
 if(anchor.toISOString().slice(0,10)!==joined)throw Error('Invalid joining date');
 const targetFirst=new Date(Date.UTC(year,month-1+monthIndex,1));
 const targetYear=targetFirst.getUTCFullYear(),targetMonth=targetFirst.getUTCMonth();
 const last=new Date(Date.UTC(targetYear,targetMonth+1,0)).getUTCDate();
 return new Date(Date.UTC(targetYear,targetMonth,Math.min(day,last))).toISOString().slice(0,10);
}
export function reportingPeriods(joined:string,today:string,maxMonths=120){
 if(!ISO.test(today))throw Error('Invalid today date');
 const result:{dueOn:string;periodStart:string}[]=[];
 for(let n=1;n<=maxMonths;n++){
  const dueOn=monthlyDueDate(joined,n);
  if(dueOn>today)break;
  result.push({dueOn,periodStart:monthlyDueDate(joined,n-1)});
 }
 return result;
}
// A non-overlapping report window centered around the month's due date.
// A report filed slightly late (e.g. Dec 15 for Dec 13) still counts for
// December, not January. Windows cannot count one report for two months.
export function reportingWindows(joined:string,today:string){
 const periods=reportingPeriods(joined,today);
 const midpoint=(left:string,right:string)=>{
  const a=Date.parse(left+'T00:00:00Z'),b=Date.parse(right+'T00:00:00Z');
  return new Date(Math.floor((a+b)/2)).toISOString().slice(0,10);
 };
 return periods.map((period,i)=>{
  const next=monthlyDueDate(joined,i+2);
  return {...period,
   reportStartInclusive:midpoint(period.periodStart,period.dueOn),
   reportEndExclusive:midpoint(period.dueOn,next)};
 });
}
export function compareMeasurements<T extends object>(
 first:T,
 latest:T,
 fields:readonly (keyof T & string)[]
):Record<string,number|null>{
 return Object.fromEntries(fields.map(field=>{
  const left=first[field] as unknown,right=latest[field] as unknown;
  const delta=typeof left==='number'&&Number.isFinite(left)&&typeof right==='number'&&Number.isFinite(right)
   ?Math.round((right-left)*100)/100:null;
  return [field,delta];
 }));
}
