import { assets } from './assets.js';
const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const hash=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
const password=async(p,s)=>hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(s),iterations:100000,hash:'SHA-256'},await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveBits']),256));
const day=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const json=(v,status=200,headers={})=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const fail=(s,m)=>{throw Object.assign(new Error(m),{status:s});};
const profile=u=>({id:u.id,...JSON.parse(u.profile)});
const clean=(s,n=100)=>String(s||'').trim().slice(0,n);
async function body(req){const t=await req.text();if(t.length>500000)fail(413,'요청이 너무 큽니다.');try{return JSON.parse(t);}catch{fail(400,'입력 내용을 확인해 주세요.');}}
async function api(req,env){
 const url=new URL(req.url),path=url.pathname,db=env.DB;
 if(path==='/api/health')return json({ok:true,database:!!db});
 if(!db)fail(503,'데이터베이스를 준비하고 있습니다.');
 if(req.method!=='GET'&&req.headers.get('origin')&&req.headers.get('origin')!==url.origin)fail(403,'허용되지 않은 요청입니다.');
 const methods={'/api/me':'GET','/api/health':'GET','/api/recommendations':'GET','/api/connections':'GET','/api/blocks':'GET','/api/profile':'PUT','/api/block':'POST','/api/report':'POST','/api/likes':'POST','/api/logout':'POST'};
 if(methods[path]&&methods[path]!==req.method)fail(405,'허용되지 않은 요청 방식입니다.');
 const first=(q,...a)=>db.prepare(q).bind(...a).first();
 const rows=async(q,...a)=>(await db.prepare(q).bind(...a).all()).results;
 const run=(q,...a)=>db.prepare(q).bind(...a).run();
 const cookie=req.headers.get('cookie')?.match(/(?:^|; )session=([^;]+)/)?.[1];
 const token=cookie?await hash(cookie):'';
 const user=token?await first('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',token,Date.now()):null;
 const blocked=async a=>!!await first('SELECT 1 FROM blocks WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)',user.id,a,a,user.id);
 const matched=async a=>!await blocked(a)&&!!await first('SELECT 1 FROM likes a JOIN likes b ON a.sender=b.recipient AND a.recipient=b.sender WHERE a.sender=? AND a.recipient=?',user.id,a);
 if(path==='/api/register'||path==='/api/login'){
  if(req.method!=='POST')fail(405,'POST 요청이 필요해요.');
  const b=await body(req),email=clean(b.email,254).toLowerCase(),p=String(b.password||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||p.length<10||p.length>128)fail(400,'이메일과 10~128자 비밀번호를 입력해 주세요.');
  const key=await hash((req.headers.get('cf-connecting-ip')||'local')+email),now=Date.now();
  const attempt=await first('SELECT * FROM attempts WHERE key=?',key);
  if(attempt&&attempt.expires>now&&attempt.count>=10)fail(429,'로그인 시도가 많아요. 15분 뒤 다시 시도해 주세요.');
  await run('INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END',key,now+900000,now,now);
  let u=await first('SELECT * FROM users WHERE email=?',email);
  if(path==='/api/register'){
   if(u)fail(409,'이미 가입된 이메일이에요. 로그인해 주세요.');
   const id=crypto.randomUUID(),salt=crypto.randomUUID(),pw=await password(p,salt);
   try{await run('INSERT INTO users(id,email,password,salt,created) VALUES (?,?,?,?,?)',id,email,pw,salt,now);}catch(e){if(String(e).includes('UNIQUE'))fail(409,'이미 가입된 이메일이에요.');throw e;}u={id,profile:null};
  }else if(!u||await password(p,u.salt)!==u.password)fail(401,'이메일 또는 비밀번호가 맞지 않아요.');
  const session=crypto.randomUUID()+crypto.randomUUID();await run('INSERT INTO sessions VALUES (?,?,?)',await hash(session),u.id,now+30*86400000);
  await run('DELETE FROM attempts WHERE key=?',key);
  return json({user:{id:u.id,profile:u.profile?JSON.parse(u.profile):null}},200,{'Set-Cookie':`session=${session}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${url.protocol==='https:'?'; Secure':''}`});
 }
 if(path==='/api/me'&&req.method==='GET')return json({user:user?{id:user.id,email:user.email,profile:user.profile?JSON.parse(user.profile):null}:null});
 if(!user)fail(401,'로그인이 필요해요.');
 if(path==='/api/logout'&&req.method==='POST'){await run('DELETE FROM sessions WHERE token=?',token);return json({ok:true},200,{'Set-Cookie':'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'});}
 if(path==='/api/profile'&&req.method==='PUT'){
  const b=await body(req),p={name:clean(b.name,30),age:Number(b.age),location:clean(b.location,60),job:clean(b.job,60),education:clean(b.education,40),height:Number(b.height),role:b.role==='developer'?'developer':'non-developer',meeting:clean(b.meeting,80),contact:clean(b.contact,80),preference:clean(b.preference,30),intro:clean(b.intro,1000),photo:clean(b.photo,200),tags:Array.isArray(b.tags)?b.tags.slice(0,5).map(x=>clean(x,20)):[],smoking:clean(b.smoking,30),drinking:clean(b.drinking,30),religion:clean(b.religion,30),minAge:Number(b.minAge)||19,maxAge:Number(b.maxAge)||60,region:clean(b.region,40),githubVerified:false,photoReviewed:false};
  if(!p.name||!Number.isInteger(p.age)||p.age<19||p.age>80||!p.location||!p.job||!p.education||p.height<100||p.height>250||!p.intro||!p.meeting||!p.contact)fail(400,'필수 정보와 나이(19~80세), 키(100~250cm)를 확인해 주세요.');
  if(p.minAge<19||p.maxAge>80||p.minAge>p.maxAge)fail(400,'추천 나이 범위를 확인해 주세요.');
  if(p.photo&&!p.photo.startsWith('/api/photo/'+user.id+'/'))fail(400,'직접 등록한 사진만 사용할 수 있어요.');
  await run('UPDATE users SET profile=? WHERE id=?',JSON.stringify(p),user.id);return json({profile:p});
 }
 if(path==='/api/photo'&&req.method==='POST'){
  if(!env.BUCKET)fail(503,'사진 저장소가 준비되지 않았어요.');
  const bytes=await req.arrayBuffer();if(bytes.byteLength>400000)fail(413,'400KB 이하의 사진을 등록해 주세요.');
  if(bytes.byteLength<4||new Uint8Array(bytes)[0]!==255||new Uint8Array(bytes)[1]!==216)fail(400,'JPEG 사진이 필요해요.');
  const key=user.id+'/'+crypto.randomUUID()+'.jpg';await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});return json({photo:'/api/photo/'+key});
 }
 if(path.startsWith('/api/photo/')&&req.method==='GET'){
  const object=await env.BUCKET?.get(path.slice(11));if(!object)fail(404,'사진이 없어요.');return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=300'}});
 }
 if(!user.profile)fail(400,'프로필을 먼저 완성해 주세요.');
 if(path==='/api/recommendations'){
  const p=JSON.parse(user.profile),today=day();
  let assigned=await rows('SELECT recipient FROM recommendations WHERE owner=? AND day=?',user.id,today);
  if(!assigned.length){
   let candidates=await rows('SELECT id,profile FROM users WHERE id<>? AND profile IS NOT NULL ORDER BY created DESC LIMIT 500',user.id);
   candidates=candidates.filter(u=>{const q=JSON.parse(u.profile);return q.age>=p.minAge&&q.age<=p.maxAge&&(!p.region||q.location.includes(p.region))&&(p.role!=='non-developer'||q.role==='developer')&&(p.preference!=='개발자'||q.role==='developer')&&(p.preference!=='비개발자'||q.role!=='developer');});
   const allowed=[];for(const u of candidates){if(!await blocked(u.id)){const q=JSON.parse(u.profile);allowed.push({...u,score:(q.contact===p.contact?2:0)+(q.meeting===p.meeting?2:0)});}}
   allowed.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
   for(const u of allowed.slice(0,3))await run('INSERT OR IGNORE INTO recommendations VALUES (?,?,?)',user.id,today,u.id);
   assigned=await rows('SELECT recipient FROM recommendations WHERE owner=? AND day=?',user.id,today);
  }
  const people=[];for(const a of assigned){const u=await first('SELECT id,profile FROM users WHERE id=?',a.recipient);if(u?.profile&&!await blocked(u.id))people.push(profile(u));}
  const liked=await rows('SELECT recipient FROM likes WHERE sender=? AND day=?',user.id,today);
  return json({people,liked:liked.map(l=>l.recipient),remaining:3-liked.length,day:today});
 }
 if(path==='/api/likes'&&req.method==='POST'){
  const b=await body(req),target=clean(b.id);if(target===user.id||await blocked(target))fail(403,'좋아요를 보낼 수 없어요.');
  if(!await first('SELECT 1 FROM recommendations WHERE owner=? AND recipient=? AND day=?',user.id,target,day()))fail(403,'오늘 추천받은 분에게만 보낼 수 있어요.');
  if(!await first('SELECT 1 FROM likes WHERE sender=? AND recipient=? AND day=?',user.id,target,day())){try{await run('INSERT INTO likes VALUES (?,?,?,?)',user.id,target,day(),Date.now());}catch(e){if(String(e).includes('DAILY_LIMIT'))fail(429,'오늘의 좋아요를 모두 사용했어요.');throw e;}}
  return json({matched:await matched(target)});
 }
 if(path==='/api/connections'){
  const sent=await rows('SELECT DISTINCT u.id,u.profile FROM users u JOIN likes l ON l.recipient=u.id WHERE l.sender=? AND u.profile IS NOT NULL',user.id),received=await rows('SELECT DISTINCT u.id,u.profile FROM users u JOIN likes l ON l.sender=u.id WHERE l.recipient=? AND u.profile IS NOT NULL',user.id);
  const visible=async xs=>{const a=[];for(const u of xs)if(!await blocked(u.id))a.push(profile(u));return a;};
  const s=await visible(sent),r=await visible(received);return json({sent:s,received:r,matches:s.filter(p=>r.some(q=>p.id===q.id))});
 }
 if(path.startsWith('/api/messages/')){
  const target=path.split('/').pop();if(!await matched(target))fail(403,'상호 좋아요를 보낸 분과만 대화할 수 있어요.');
  if(req.method==='GET')return json({messages:await rows('SELECT * FROM (SELECT id,sender,text,created FROM messages WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?) ORDER BY created DESC LIMIT 200) ORDER BY created ASC',user.id,target,target,user.id)});
  if(req.method==='POST'){const b=await body(req),text=clean(b.text,1000);if(!text)fail(400,'메시지를 입력해 주세요.');const id=crypto.randomUUID();await run('INSERT INTO messages VALUES (?,?,?,?,?)',id,user.id,target,text,Date.now());return json({id});}
 }
 if(path==='/api/block'&&req.method==='POST'){
  const b=await body(req);if(b.id===user.id||!await first('SELECT id FROM users WHERE id=?',b.id))fail(400,'유효한 상대가 아니에요.');
  if(b.remove)await run('DELETE FROM blocks WHERE sender=? AND recipient=?',user.id,b.id);else await run('INSERT OR IGNORE INTO blocks VALUES (?,?)',user.id,b.id);return json({ok:true});
 }
 if(path==='/api/blocks')return json({people:(await rows('SELECT u.id,u.profile FROM users u JOIN blocks b ON b.recipient=u.id WHERE b.sender=?',user.id)).filter(u=>u.profile).map(profile)});
 if(path==='/api/report'&&req.method==='POST'){
  const b=await body(req);if(!await first('SELECT id FROM users WHERE id=?',b.id)||!clean(b.reason))fail(400,'신고 대상과 사유를 확인해 주세요.');
  const id=crypto.randomUUID();await run('INSERT INTO reports VALUES (?,?,?,?,?)',id,user.id,b.id,clean(b.reason,1000),Date.now());return json({id});
 }
 fail(404,'요청한 기능을 찾을 수 없어요.');
}
export default {async fetch(req,env){
 try{
  const path=new URL(req.url).pathname;
  if(path.startsWith('/api/'))return await api(req,env);
  const asset=assets[path==='/'||path==='/local.html'?'/index.html':path];if(!asset)return new Response('Not found',{status:404});
  return new Response(Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://images.unsplash.com; script-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'"}});
 }catch(e){return json({error:e.status?e.message:'요청을 처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.'},e.status||500);}
}};
