import test from 'node:test';import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';import {database} from '../scripts/local-db.mjs';
const env={DB:database(),BUCKET:{files:new Map(),async put(k,v){this.files.set(k,v)},async get(k){return this.files.has(k)?{body:this.files.get(k)}:null}}};
const cookie={};
async function request(who,path,method='GET',data,extra={}){const r=await worker.fetch(new Request('https://test.local/api/'+path,{method,headers:{'Content-Type':'application/json',...(cookie[who]?{cookie:cookie[who]}:{}),...extra},body:data?JSON.stringify(data):undefined}),env);if(r.headers.has('set-cookie'))cookie[who]=r.headers.get('set-cookie').split(';')[0];const b=await r.json();return {status:r.status,body:b};}
const p=name=>({name,age:29,height:170,location:'서울 성동구',job:'개발자',role:'developer',education:'대학교 졸업',meeting:'주말에 1–2번',contact:'바쁜 날에도 짧은 안부',preference:'상관없어요',intro:'반가워요. 함께 이야기해요.'});
const ids={};
test('가입, 검증, 프로필 저장, 기기 간 로그인',async()=>{
 assert.equal((await request('anon','profile','PUT',p('익명'))).status,401);
 for(const name of ['a','b','c','d']){const r=await request(name,'register','POST',{email:name+'@example.test',password:'correct-password-123'});assert.equal(r.status,200);ids[name]=r.body.user.id;assert.equal((await request(name,'profile','PUT',p(name))).status,200);}
 assert.equal((await request('dup','register','POST',{email:'a@example.test',password:'correct-password-123'})).status,409);
 assert.equal((await request('bad','login','POST',{email:'a@example.test',password:'wrong-password'})).status,401);
 assert.equal((await request('a','profile','PUT',{...p('a'),age:17})).status,400);
 assert.equal((await request('other-device','login','POST',{email:'a@example.test',password:'correct-password-123'})).status,200);
 assert.equal((await request('other-device','me')).body.user.profile.name,'a');
 assert.equal((await request('a','profile','PUT',p('a'),{origin:'https://attacker.test'})).status,403);
});
test('하루 3명 추천, 중복 좋아요 방지, 상호 매칭 전 대화 금지',async()=>{
 const r=await request('a','recommendations');assert.equal(r.body.people.length,3);assert.ok(r.body.people.every(p=>!('email'in p)&&!('password'in p)));assert.equal(r.body.remaining,3);
 assert.deepEqual((await request('a','recommendations')).body.people.map(p=>p.id),r.body.people.map(p=>p.id));
 assert.equal((await request('a','messages/'+ids.b,'POST',{text:'아직 매칭 전'})).status,403);
 assert.equal((await request('a','likes','POST',{id:ids.b})).body.matched,false);
 await request('a','likes','POST',{id:ids.b});assert.equal((await request('a','recommendations')).body.remaining,2);
 await request('b','recommendations');assert.equal((await request('b','likes','POST',{id:ids.a})).body.matched,true);
 assert.equal((await request('a','connections')).body.matches[0].id,ids.b);
 for(const id of [ids.c,ids.d])assert.equal((await request('a','likes','POST',{id})).status,200);
 assert.equal((await request('a','recommendations')).body.remaining,0);
 assert.throws(()=>env.DB.raw.prepare('INSERT INTO likes VALUES (?,?,?,?)').run(ids.a,'extra',r.body.day,Date.now()),/DAILY_LIMIT/);
});
test('메시지 실제 저장·상대 수신·권한 차단·신고·차단 해제',async()=>{
 const text='안녕하세요! <script>alert(1)</script>';
 assert.equal((await request('a','messages/'+ids.b,'POST',{text})).status,200);
 assert.equal((await request('b','messages/'+ids.a)).body.messages[0].text,text);
 assert.equal((await request('other-device','messages/'+ids.b)).body.messages[0].text,text);
 assert.equal((await request('c','messages/'+ids.b)).status,403);
 const report=await request('a','report','POST',{id:ids.b,reason:'테스트 신고'});assert.equal(report.status,200);assert.ok(report.body.id);
 assert.equal((await request('b','block','POST',{id:ids.a})).status,200);
 assert.equal((await request('a','messages/'+ids.b,'POST',{text:'차단 후'})).status,403);
 assert.equal((await request('a','connections')).body.matches.length,0);
 assert.ok(!(await request('a','recommendations')).body.people.some(p=>p.id===ids.b));
 assert.equal((await request('b','blocks')).body.people.length,1);
 await request('b','block','POST',{id:ids.a,remove:true});assert.equal((await request('a','connections')).body.matches.length,1);
 await request('a','logout','POST',{});assert.equal((await request('a','me')).body.user,null);
 assert.ok((await request('other-device','me')).body.user);
});
test('에셋, local.html 경로, 비인증 사진 접근',async()=>{
 const page=await worker.fetch(new Request('https://test.local/local.html'),env);assert.equal(page.status,200);assert.ok((await page.text()).includes('id="app"'));
 assert.equal((await request('anon','photo/unknown')).status,401);
 const resp=await worker.fetch(new Request('https://test.local/app.js'),env);assert.equal(resp.status,200);assert.match(resp.headers.get('content-type'),/javascript/);
});
