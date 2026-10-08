import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../server/core.mjs';
class MemoryStore{
 constructor(){this.data=new Map();this.version=0}
 async get(key){return this.data.has(key)?structuredClone(this.data.get(key).data):null}
 async getWithMetadata(key){return this.data.has(key)?structuredClone(this.data.get(key)):null}
 async setJSON(key,data,conditions={}){const old=this.data.get(key);if(conditions.onlyIfNew&&old)return {modified:false};if(conditions.onlyIfMatch&&old?.etag!==conditions.onlyIfMatch)return {modified:false};const etag='"'+(++this.version)+'"';this.data.set(key,{data:structuredClone(data),etag});return {modified:true,etag}}
 async list({prefix}){return {blobs:[...this.data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))}}
 async delete(key){this.data.delete(key)}
}
const store=new MemoryStore();const handler=createHandler(()=>store,{INITIAL_PASSWORD:'InicialDeTeste2026!',CONTEXT:'production'});
class Client{
 constructor(){this.cookie='';this.csrf=''}
 async call(path,body,expected=200,useCsrf=true){const headers={'cookie':this.cookie};if(body!==undefined){headers['content-type']='application/json';headers['x-csrf-token']=useCsrf?this.csrf:'';headers.origin='https://visitas.example'}const response=await handler(new Request('https://visitas.example'+path,{method:body===undefined?'GET':'POST',headers,...(body===undefined?{}:{body:JSON.stringify(body)})}),{ip:'192.0.2.1'});const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));if(response.headers.get('set-cookie'))this.cookie=response.headers.get('set-cookie').split(';')[0];if(data.csrf)this.csrf=data.csrf;return data}
 async first(login){const result=await this.call('/api/login',{login,password:'InicialDeTeste2026!'});assert.equal(result.user.mustChange,true);await this.call('/api/data',undefined,403);await this.call('/api/password',{password:'MinhaSenha2026!','confirmation':'diferente'},400);await this.call('/api/password',{password:'MinhaSenha2026!',confirmation:'MinhaSenha2026!'});}
}
test('Netlify login, ownership, persistence and immutable visits',async()=>{
 const a=new Client();await a.call('/api/data',undefined,401);await a.first('ACHICALE@petzcobasi.com.br');const d=await a.call('/api/data');assert.equal(d.stores.length,29);
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
 const records=await Promise.all(Array.from({length:5},()=>a.call('/api/visits',{code:'015',date:day,note:'Visita'})));
 assert.equal((await a.call('/api/data')).visits.length,5);
 await a.call('/api/visits',{code:'001',date:day},403);await a.call('/api/visits',{code:'015',date:'2099-01-01'},400);await a.call('/api/visits',{code:'015',date:day},403,false);
 const f=new Client();await f.first('famorim');assert.equal((await f.call('/api/data')).stores.length,260);assert.equal((await f.call('/api/data')).visits.length,0);
 await f.call('/api/visits/delete',{id:records[0].id,reason:'Marcação indevida'},404);
 const t=new Client();await t.first('stephanie.silva');assert.equal((await t.call('/api/data')).stores.length,260);assert.equal((await t.call('/api/data')).visits.length,0);
 const secondBrowser=new Client();await secondBrowser.call('/api/login',{login:'achicale',password:'MinhaSenha2026!'});assert.equal((await secondBrowser.call('/api/data')).visits.length,5);
 await secondBrowser.call('/api/visits/delete',{id:records[0].id,reason:'Outro',note:'  '},400);
 await secondBrowser.call('/api/visits/delete',{id:records[0].id,reason:'Outro',note:'Loja incorreta'});
 assert.equal((await a.call('/api/data')).visits.filter(v=>v.deletedAt).length,1);
 await secondBrowser.call('/api/visits/delete',{id:records[0].id,reason:'Marcação indevida'},409);
 await a.call('/api/password',{password:'OutraSenha2026!',confirmation:'OutraSenha2026!',currentPassword:'MinhaSenha2026!'});
 await secondBrowser.call('/api/data',undefined,401);
 const fresh=new Client();await fresh.call('/api/login',{login:'achicale',password:'InicialDeTeste2026!'},401);await fresh.call('/api/login',{login:'achicale',password:'OutraSenha2026!'});
 const old=[{id:'old1',author:'Regional André Chicale',code:'015',date:'2026-01-01',note:'antiga'},{author:'Francisco Amorim',code:'015',date:'2026-01-01'}];
 assert.equal((await fresh.call('/api/import',{visits:old})).imported,1);assert.equal((await fresh.call('/api/import',{visits:old})).imported,0);
 // A fresh handler, representing a new function instance/deploy, reads the same persistent objects.
 const newHandler=createHandler(()=>store,{INITIAL_PASSWORD:'InicialDeTeste2026!',CONTEXT:'production'});const result=await newHandler(new Request('https://visitas.example/api/data',{headers:{cookie:fresh.cookie}}),{ip:'192.0.2.1'});assert.equal((await result.json()).visits.length,6);
 const ownPermissions=await fresh.call('/api/permissions');assert.equal(ownPermissions.users.length,1);assert.equal(ownPermissions.users[0].stores.length,29);const fullPermissions=await t.call('/api/permissions');assert.equal(fullPermissions.users.length,11);assert.equal(fullPermissions.users.reduce((n,u)=>n+u.stores.length,0),780);assert.ok(fullPermissions.users.every(u=>!('password' in u)));const encoded=[...store.data.entries()].filter(([k])=>k.startsWith('users/')).map(([,v])=>v.data.password);assert.ok(encoded.every(s=>!s.includes('InicialDeTeste2026!')));
 await fresh.call('/api/logout',{});await fresh.call('/api/data',undefined,401);
});
test('password configuration and cross-origin protection',async()=>{
 const isolated=new MemoryStore();const unconfigured=createHandler(()=>isolated,{});
 const req=()=>new Request('https://visitas.example/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({login:'dkoch',password:'InicialDeTeste2026!'})});assert.equal((await unconfigured(req())).status,503);
 const wrongOrigin=new Request('https://visitas.example/api/login',{method:'POST',headers:{'content-type':'application/json',origin:'https://bad.example'},body:'{}'});assert.equal((await handler(wrongOrigin)).status,403);
 const preview=createHandler(()=>store,{CONTEXT:'deploy-preview'});assert.equal((await preview(req())).status,503);
});
