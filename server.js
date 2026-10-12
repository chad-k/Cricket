import http from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {create,act,tick,view} from './game.js';
const assets=new Map(['/','/app.js','/characters.js','/style.css'].map(url=>[url,{body:readFileSync(new URL('./public/'+(url==='/'?'index.html':url.slice(1)),import.meta.url)),mime:url==='/'?'text/html; charset=utf-8':url.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8'}]));
export function createServer({now=Date.now,tickMs=50}={}){
 const rooms=new Map(),limits=new Map();
 const identify=t=>{if(!/^[a-f0-9-]{36}$/i.test(t||''))throw Error('Reload the page to reconnect.');return createHash('sha256').update(t).digest('hex');};
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const allow=(id,type,max)=>{const key=id+type;let b=limits.get(key);if(!b||now()-b.at>60000){b={at:now(),n:0};limits.set(key,b);}return ++b.n<=max;};
 const snapshot=(room,id)=>({code:room.code,serverNow:now(),revision:room.revision,game:view(room.game,id),messages:room.messages,online:[...room.clients.keys()]});
 const broadcast=room=>{room.revision++;for(const [id,connections] of room.clients)for(const res of connections){if(res.writableLength>100000){res.destroy();continue;}res.write('data: '+JSON.stringify(snapshot(room,id))+'\n\n');}room.lastPush=now();};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
  const url=new URL(req.url,'http://local');
  try{
   if(req.method==='GET'&&url.pathname==='/healthz')return json(res,200,{ok:true});
   if(req.method==='GET'&&url.pathname==='/api/time')return json(res,200,{serverNow:now()});
   if(req.method==='GET'&&url.pathname==='/events'){
    const id=identify(url.searchParams.get('token')),room=rooms.get(url.searchParams.get('room'));
    if(!room||![...room.game.players,...room.game.spectators].some(p=>p.id===id))return json(res,403,{error:'Join this room first.'});
    const connections=room.clients.get(id)||new Set();if(connections.size>=3)return json(res,429,{error:'Too many tabs for this player.'});
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');connections.add(res);room.clients.set(id,connections);room.touched=now();broadcast(room);
    req.on('close',()=>{connections.delete(res);if(!connections.size)room.clients.delete(id);broadcast(room);});return;
   }
   if(req.method==='POST'&&url.pathname==='/api/action'){
    const id=identify(req.headers['x-player-token']);if(!allow(id,'actions',160))return json(res,429,{error:'Please slow down.'});
    let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>8192){json(res,413,{error:'Request too large.'});return;}raw+=chunk;}
    let b;try{b=JSON.parse(raw);}catch{return json(res,400,{error:'Invalid request.'});}
    if(!b||typeof b!=='object'||Array.isArray(b))throw Error('Invalid request.');
    let room;
    if(b.action==='create'){
     if(!String(b.name||'').trim())throw Error('Enter your name.');if(rooms.size>=100)throw Error('Rooms are busy. Try again later.');
     let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));room={code,game:create(id,b.name,b.avatar),messages:[],clients:new Map(),revision:0,touched:now(),lastPush:0};rooms.set(code,room);
    }else{
     room=rooms.get(String(b.code||'').toUpperCase());if(!room)throw Error('Room not found. Ask for a new invite.');tick(room.game,now());
     if(b.action==='chat'){
      const p=[...room.game.players,...room.game.spectators].find(p=>p.id===id);if(!p)throw Error('Join before chatting.');if(typeof b.text!=='string'||!b.text.trim()||b.text.length>250)throw Error('Use 1–250 characters.');if(!allow(id,'chat',20))throw Error('Chat limit: 20 messages per minute.');
      room.messages.push({name:p.name,text:b.text.trim(),time:now()});room.messages=room.messages.slice(-70);
     }else{
      if(b.action!=='join'&&b.match!==room.game.match)throw Error('The match changed. Wait for the latest scoreboard.');
      const next=structuredClone(room.game);act(next,id,b.action,b,now());room.game=next;
     }
    }
    room.touched=now();broadcast(room);return json(res,200,snapshot(room,id));
   }
   const file=assets.get(url.pathname);if(req.method==='GET'&&file){res.writeHead(200,{'Content-Type':file.mime,'Cache-Control':'no-cache'});res.end(file.body);return;}
   json(res,404,{error:'Not found.'});
  }catch(e){json(res,400,{error:e.message||'Request failed.'});}
 });
 const timer=setInterval(()=>{for(const [code,room] of rooms){
  tick(room.game,now());if(now()-room.lastPush>=(room.game.phase==='flight'?120:1000))broadcast(room);
  if(room.clients.size)room.touched=now();if(now()-room.touched>6*3600000){rooms.delete(code);}
 }for(const [key,b] of limits)if(now()-b.at>120000)limits.delete(key);},tickMs);timer.unref();
 server.dispose=()=>{clearInterval(timer);for(const room of rooms.values())for(const connections of room.clients.values())for(const res of connections)res.end();};
 return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const s=createServer();s.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Crease is listening.'));}
