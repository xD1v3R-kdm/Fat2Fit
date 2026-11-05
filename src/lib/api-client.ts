export async function api<T=unknown>(path:string, method='GET', body?:unknown):Promise<T>{
  const response=await fetch(`/api${path}`,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});
  if(!response.ok){const error=await response.json().catch(()=>({error:'Request failed'}));throw Error(error.error||`HTTP ${response.status}`);}
  return response.json() as Promise<T>;
}
