import {CHARACTERS,POWERS,characterFor,bendOffset,easyTiming} from './characters.js';
const $=id=>document.getElementById(id),avatars=CHARACTERS.map(c=>c.icon);
let token;try{token=localStorage.getItem('crease-token')||crypto.randomUUID();localStorage.setItem('crease-token',token);$('name').value=localStorage.getItem('crease-name')||'';}catch{token=crypto.randomUUID();}
let batPower='none',bowlPower='none';
let avatar=0,state=null,stream=null,revision=-1,aim=0,kind='drive',line=0,type='pace',offset=Date.now()-performance.now(),rtt=0,clockReady=false,shotPending=false,pendingBall=null,busy=false,errorTimer,renderKey='',messagesKey='',lastSettings='',samples=[];
const serverTime=()=>performance.now()+offset;
$('code').value=(new URLSearchParams(location.search).get('room')||'').toUpperCase();
function error(message){$('error').textContent=message;$('error').hidden=!message;clearTimeout(errorTimer);if(message)errorTimer=setTimeout(()=>error(''),6500);}
function element(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function selection(id,value){for(const b of $(id).querySelectorAll('button')){b.classList.toggle('selected',b.dataset.value===String(value));b.setAttribute('aria-pressed',String(b.dataset.value===String(value)));}}
function characterCard(c){const box=element('div');box.append(element('b',c.icon+' '+c.name+' · '+c.personality),element('p','Bat · '+POWERS[c.bat].name+': '+(POWERS[c.bat].easyDescription||POWERS[c.bat].description)+' (Easy controls)'),element('p','Bowl · '+POWERS[c.bowl].name+': '+(POWERS[c.bowl].easyDescription||POWERS[c.bowl].description)+' (Easy controls)'));return box;}
function previewAvatar(){const c=characterFor(avatar);$('avatar-preview').replaceChildren(characterCard(c));for(const [i,b] of [...$('avatars').children].entries()){b.classList.toggle('selected',avatar===i);b.setAttribute('aria-pressed',String(avatar===i));}}
for(let i=0;i<avatars.length;i++){const c=CHARACTERS[i],b=element('button',c.icon);b.title=c.name+' · '+c.personality;b.setAttribute('aria-label','Choose '+c.name);b.onclick=()=>{avatar=i;previewAvatar();};$('avatars').append(b);const pick=element('button');pick.append(characterCard(c));pick.onclick=()=>guarded('avatar',{avatar:i});$('lobby-avatars').append(pick);}
previewAvatar();
for(const [id,set] of [['bat-aim',v=>aim=Number(v)],['bat-kind',v=>kind=v],['bowl-line',v=>line=Number(v)],['bowl-type',v=>type=v],['bat-power',v=>batPower=v],['bowl-power',v=>bowlPower=v]])for(const b of $(id).children)b.onclick=()=>{set(b.dataset.value);selection(id,b.dataset.value);};
async function syncClock(){
 try{const before=performance.now(),res=await fetch('/api/time',{cache:'no-store'}),d=await res.json(),after=performance.now();samples.push({rtt:after-before,offset:d.serverNow-(before+after)/2});samples=samples.slice(-8);const best=[...samples].sort((a,b)=>a.rtt-b.rtt)[0];offset=best.offset;rtt=Math.round(best.rtt);clockReady=true;$('ping').textContent=rtt+' ms';}catch{}
}
await syncClock();setTimeout(syncClock,400);setTimeout(syncClock,900);setInterval(syncClock,15000);
function receive(d){if(d.revision<revision)return;revision=d.revision;if(d.game.phase==='ready'&&state?.game.phase!=='ready'||d.game.phase==='lobby'){batPower='none';bowlPower='none';}state=d;if(pendingBall!==d.game.delivery?.id){pendingBall=d.game.delivery?.id;shotPending=false;}render();}
function connect(code){if(stream)stream.close();stream=new EventSource('/events?room='+encodeURIComponent(code)+'&token='+encodeURIComponent(token));stream.onopen=()=>{$('connection').textContent='Live connection';};stream.onmessage=e=>{try{receive(JSON.parse(e.data));}catch{error('Could not read a match update.');}};stream.onerror=()=>{$('connection').textContent='Reconnecting…';};}
async function action(action,extra={}){
 const body={action,code:state?.code||$('code').value.trim().toUpperCase(),name:$('name').value.trim(),avatar,match:state?.game.match??0,...extra};
 try{const res=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json','x-player-token':token},body:JSON.stringify(body)}),d=await res.json();if(!res.ok)throw Error(d.error||'Unable to complete that action.');const first=!state;receive(d);if(first){history.replaceState(null,'','?room='+d.code);connect(d.code);try{localStorage.setItem('crease-name',body.name);}catch{}}return true;}catch(e){error(e.message||'Connection lost. Please retry.');return false;}
}
async function guarded(name,extra={}){if(busy)return;busy=true;render();try{return await action(name,extra);}finally{busy=false;render();}}
$('create').onclick=()=>{if(!$('name').value.trim())return error('Enter your name.');guarded('create');};
$('join').onclick=()=>{if(!$('name').value.trim())return error('Enter your name.');guarded('join');};
$('watch').onclick=()=>{if(!$('name').value.trim())return error('Enter your name.');guarded('join',{seat:'spectator'});};
$('bot').onclick=()=>guarded('bot');$('remove-bot').onclick=()=>guarded('removeBot');$('start').onclick=()=>guarded('start');$('rematch').onclick=()=>guarded('rematch');
$('choose-bat').onclick=()=>guarded('toss',{choice:'bat'});$('choose-bowl').onclick=()=>guarded('toss',{choice:'bowl'});
for(const id of ['overs','wickets','mode','controls'])$(id).onchange=()=>guarded('settings',{overs:Number($('overs').value),wickets:Number($('wickets').value),mode:$('mode').value,controls:$('controls').value});
$('bowl').onclick=()=>guarded('bowl',state?.game.settings.controls==='easy'?{line:Math.floor(Math.random()*3)-1,type}:{line,type,power:bowlPower});
$('invite').onclick=async()=>{const link=location.origin+'/?room='+state.code;try{await navigator.clipboard.writeText(link);$('invite').textContent='Invite copied ✓';setTimeout(()=>$('invite').textContent='Copy invite link ↗',2000);}catch{prompt('Copy this invite link',link);}};
async function swing(){const g=state?.game,d=g?.delivery,t=serverTime();if(!d||g.role!=='batter'||g.phase!=='flight'||d.shot||shotPending||!clockReady||t<d.releaseAt||t>d.impactAt+(d.easy?450:350))return;shotPending=true;render();const ok=await action('swing',{delivery:d.id,aim,kind,at:t,power:batPower});if(!ok)shotPending=false;render();}
$('swing').onclick=swing;$('quick-hit').onclick=swing;
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||!['ready','flight'].includes(state?.game.phase)||state?.game.role!=='batter')return;if(e.code==='Space'){e.preventDefault();if(!e.repeat)swing();}if(state.game.settings.controls==='easy')return;if(e.key.toLowerCase()==='a'||e.key==='ArrowLeft'){aim=Math.max(-1,aim-1);selection('bat-aim',aim);}if(e.key.toLowerCase()==='d'||e.key==='ArrowRight'){aim=Math.min(1,aim+1);selection('bat-aim',aim);}if(['1','2','3'].includes(e.key)){kind=['defend','drive','loft'][Number(e.key)-1];selection('bat-kind',kind);}});
$('chat-form').onsubmit=async e=>{e.preventDefault();const input=$('chat-input'),text=input.value;if(!text.trim())return;if(await action('chat',{text}))input.value='';};
const name=id=>state?.game.players.find(p=>p.id===id)?.name||'Player';
function show(id,on){$(id).hidden=!on;}
function render(){
 $('create').disabled=$('join').disabled=$('watch').disabled=busy;if(!state)return;
 const g=state.game,host=g.you===g.host,me=g.players.find(p=>p.id===g.you);show('entry',false);show('room',true);$('match-controls').classList.toggle('lobby-top',g.phase==='lobby');$('room-code').textContent=state.code;
 $('match-label').textContent=g.innings?`INNINGS ${g.innings} / 2 · ${g.settings.overs} OVER${g.settings.overs>1?'S':''}`:'LIVE ARCADE CRICKET';
 const phases={lobby:'Warm-up',toss:'The toss',ready:'Set the field',flight:'Ball live',result:'Ball result',interval:'Innings break',finished:'Full time'};$('phase-label').textContent=phases[g.phase];
 $('role-label').textContent=g.phase==='lobby'?(host?'ROOM HOST':me?'PLAYER':'SPECTATOR'):g.role==='batter'?'YOU ARE BATTING':g.role==='bowler'?'YOU ARE BOWLING':'SPECTATING';
 const current=g.scores.at(-1);$('equation').textContent=g.phase==='finished'?g.result.text:g.innings===2?`${name(g.batting)} needs ${Math.max(0,g.scores[0].runs+1-current.runs)} from ${Math.max(0,g.settings.overs*6-current.balls)} balls`:g.phase==='interval'?`Target ${g.scores[0].runs+1} · Players swap ends`:`${g.settings.wickets} wickets · ${g.settings.overs*6} balls per innings`;
 const key=JSON.stringify([g.players,g.scores,g.phase,g.batting,g.log,g.settings.mode,state.online,g.spectators]);if(key!==renderKey){renderKey=key;
  $('score-teams').replaceChildren();for(let i=0;i<2;i++){const p=g.players[i],s=p&&g.scores.find(s=>s.player===p.id),card=element('div',undefined,'score-team'+(p?.id===g.batting?' active':'')),n=element('div',undefined,'team-name');n.append(element('span',p?avatars[p.avatar]:'＋','team-avatar'),element('span',p?.name||'Open opponent seat'));const num=element('div',s?`${s.runs}/${s.wickets}`:'—','score-number');num.append(element('small',s?`${Math.floor(s.balls/6)}.${s.balls%6} ov`:p?'Yet to bat':'Invite a friend'));card.append(n,num);$('score-teams').append(card);}
  $('players').replaceChildren();for(const p of g.players){const row=element('div',undefined,'player-row'),info=element('div');info.append(element('b',p.name+(p.id===g.you?' · You':'')),element('small',`${p.bot?'Practice bot':p.id===g.host?'Host':'Player'} · ${p.wins} match wins`));if(g.settings.mode==='super'){const c=characterFor(p.avatar);info.append(element('small',c.name+' · '+POWERS[c.bat].name+' / '+POWERS[c.bowl].name));}row.append(element('span',avatars[p.avatar]),info,element('span','',p.bot||state.online.includes(p.id)?'online':'online offline'));$('players').append(row);}
  $('spectators').textContent=g.spectators.length?'Watching: '+g.spectators.map(p=>p.name).join(', '):'Invite friends to watch from the pavilion.';
  $('ball-history').replaceChildren();for(const s of g.scores){$('ball-history').append(element('div',name(s.player),'history-title'));for(let i=0;i<s.history.length;i+=6){const row=element('div',undefined,'ball-row');for(const b of s.history.slice(i,i+6))row.append(element('span',b,'ball-pill'+(b==='W'?' wicket':['4','6'].includes(b)?' boundary':'')));$('ball-history').append(row);}}
  $('activity').replaceChildren(...g.log.slice(-6).reverse().map(l=>element('p',l)));
 }
 const mk=JSON.stringify(state.messages);if(mk!==messagesKey){messagesKey=mk;$('messages').replaceChildren();if(!state.messages.length)$('messages').append(element('p','A little friendly rivalry is encouraged.','fine'));for(const m of state.messages){const el=element('div',undefined,'message');el.append(element('b',m.name),element('p',m.text));$('messages').append(el);}$('messages').scrollTop=$('messages').scrollHeight;}
 for(const id of ['lobby-controls','toss-controls','bowl-controls','bat-controls','waiting-controls','finished-controls'])show(id,false);
 if(g.phase==='lobby'){
  show('lobby-controls',true);for(const [i,b] of [...$('lobby-avatars').children].entries()){b.disabled=busy||!me;b.classList.toggle('selected',me?.avatar===i);b.setAttribute('aria-pressed',String(me?.avatar===i));}const sk=JSON.stringify(g.settings);if(sk!==lastSettings){lastSettings=sk;$('overs').value=g.settings.overs;$('wickets').value=g.settings.wickets;$('mode').value=g.settings.mode;$('controls').value=g.settings.controls;}
  $('controls').disabled=$('mode').disabled=$('overs').disabled=$('wickets').disabled=!host||busy;show('bot',host&&g.players.length===1);show('remove-bot',host&&g.players.some(p=>p.bot));show('start',host);$('start').disabled=g.players.length<2||busy;for(const id of ['bot','remove-bot'])$(id).disabled=busy;
  $('lobby-note').textContent=host?'Share the invite, then toss when both players are ready.':'The host chooses the format and starts the match.';
 }else if(g.phase==='toss'){
  show('toss-controls',true);$('toss-text').textContent=name(g.toss.winner)+' wins the toss.';$('toss-note').textContent=g.you===g.toss.winner?'Your choice: set a target or chase it.':'Waiting for the toss winner to choose.';for(const id of ['choose-bat','choose-bowl']){show(id,g.you===g.toss.winner);$(id).disabled=busy;}
 }else if(g.phase==='finished'){
  show('finished-controls',true);$('winner').textContent=g.result.text;$('finish-note').textContent='Same ground. Fresh rivalry? Scores reset for a rematch; session wins stay.';show('rematch',host);$('rematch').disabled=busy;
 }else if(['ready','flight'].includes(g.phase)&&g.role==='batter'){
  show('bat-controls',true);
 }else if(g.phase==='ready'&&g.role==='bowler'){
  show('bowl-controls',true);$('bowl').disabled=busy;
 }else{
  show('waiting-controls',true);$('waiting-title').textContent=g.phase==='interval'?'Time to switch roles.':g.phase==='result'?g.last.label:g.phase==='flight'?'Watch the delivery.':'Waiting for the bowler.';
  $('waiting-text').textContent=g.phase==='interval'?`${name(g.bowling)} will chase ${g.scores[0].runs+1}.`:g.phase==='result'?g.last.feedback:g.role==='bowler'?'Your ball is on its way. Can they read it?':`${name(g.batting)} at the crease. ${name(g.bowling)} with the ball.`;
 }

 const easy=g.settings.controls==='easy';for(const el of document.querySelectorAll('.manual-controls'))el.hidden=easy;show('easy-bat-note',easy);show('easy-bowl-note',easy);show('quick-hit',easy&&g.role==='batter'&&['ready','flight'].includes(g.phase));show('hit-cue',easy&&g.role==='batter'&&['ready','flight'].includes(g.phase));
 const superMode=g.settings.mode==='super';show('power-banner',superMode);
 const activePowers=[g.delivery?.bowlingPower,g.delivery?.battingPower].filter(p=>p&&p!=='none');
 $('power-banner').textContent='SUPERPOWERS · '+(me?characterFor(me.avatar).name+' · ':'')+(activePowers.length?activePowers.map(p=>POWERS[p].name.toUpperCase()).join(' + ')+' active':easy?'Automatic powers · one charge per role per over':'1 batting + 1 bowling charge per over');
 for(const [role,available,chosen] of [['bat',g.powers.battingAvailable,batPower],['bowl',g.powers.bowlingAvailable,bowlPower]]){
  const c=characterFor(me?.avatar),power=c[role],button=$(role+'-power').children[1];button.dataset.value=power;button.textContent=POWERS[power].name;$(role+'-power-description').textContent=POWERS[power].description+' Choose before you '+(role==='bat'?'swing.':'bowl.');
  show(role+'-powers',superMode&&!easy);$(role+'-charge').textContent=available?'● Charged':'○ Recharges next over';selection(role+'-power',chosen);
  for(const b of $(role+'-power').children)b.disabled=busy||(role==='bat'&&(!!g.delivery?.shot||shotPending))||(b.dataset.value!=='none'&&!available);
 }
 $('ground-title').textContent=g.phase==='flight'?g.delivery.type.toUpperCase()+' DELIVERY':g.phase==='finished'?'MATCH COMPLETE':'THE CREASE';
 $('ground-hint').textContent=g.phase==='ready'?(g.role==='batter'?(easy?'Tap when the indicator turns green.':'Watch the ball. Match its lane.'):(easy?'Choose Fast, Slow or Spin, then Bowl.':'Choose a line and delivery type.')):g.phase==='flight'?'Contact at the glowing crease':g.phase==='interval'?'New innings coming up':g.phase==='lobby'?'Your next rivalry starts here.':'';
 $('result-call').replaceChildren();if(g.phase==='result'){$('result-call').append(element('div',g.last.label),element('small',g.last.feedback));}else if(g.phase==='interval'){$('result-call').append(element('div','TARGET '+(g.scores[0].runs+1)),element('small','Swap roles. The chase is on.'));}else if(g.phase==='finished')$('result-call').append(element('div',g.result.tied?'MATCH TIED':'HOWZAT!'),element('small',g.result.text));
}
// The pitch uses the same release and contact times as the server. Rendering never decides scores.
const canvas=$('field'),ctx=canvas.getContext('2d');
function ellipse(x,y,rx,ry,fill,stroke){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function person(x,y,scale,colour,bat=false,swingAngle=0){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ellipse(1,18,15,5,'#09211755');ctx.lineCap='round';ctx.lineWidth=6;ctx.strokeStyle='#e9ecce';ctx.beginPath();ctx.moveTo(-5,4);ctx.lineTo(-7,18);ctx.moveTo(5,4);ctx.lineTo(9,18);ctx.stroke();ctx.fillStyle=colour;ctx.fillRect(-10,-16,20,23);ellipse(0,-23,7,8,'#d3a47f');ctx.fillStyle=colour;ctx.fillRect(-8,-31,16,5);ctx.strokeStyle=colour;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-7,-10);ctx.lineTo(-16,0);ctx.moveTo(7,-10);ctx.lineTo(16,-3);ctx.stroke();if(bat){ctx.translate(14,-1);ctx.rotate(swingAngle);ctx.fillStyle='#d8c48c';ctx.fillRect(-3,-24,7,33);ctx.fillStyle='#8f733d';ctx.fillRect(-1,-32,3,10);}ctx.restore();}
function draw(t){
 const g=state?.game,d=g?.delivery;ctx.clearRect(0,0,960,580);ctx.fillStyle='#183322';ctx.fillRect(0,0,960,580);
 for(let x=0;x<960;x+=80){ctx.fillStyle=x%160===0?'#254d30':'#285433';ctx.fillRect(x,0,80,580);}
 ctx.lineWidth=2;ellipse(480,295,438,255,null,'#b1c09180');ellipse(480,295,285,175,null,'#bdcc8f25');ctx.fillStyle='#142e2080';ctx.fillRect(0,0,960,42);
 // Outfielders are automatic; the bowler and batter are player-controlled.
 for(const [x,y] of [[180,145],[350,80],[650,105],[800,230],[740,440],[180,420],[480,62]])person(x,y,.7,'#d6e4b4');
 ctx.fillStyle='#a59766';ctx.beginPath();ctx.moveTo(437,132);ctx.lineTo(523,132);ctx.lineTo(553,483);ctx.lineTo(407,483);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#82734c';ctx.lineWidth=1;for(let y=153;y<480;y+=19){ctx.beginPath();ctx.moveTo(443-(y-132)*.08,y);ctx.lineTo(517+(y-132)*.08,y+3);ctx.stroke();}
 ctx.strokeStyle='#f0ead0';ctx.lineWidth=3;for(const y of [171,436]){ctx.beginPath();ctx.moveTo(y===171?425:388,y);ctx.lineTo(y===171?535:572,y);ctx.stroke();}
 ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(423,168);ctx.lineTo(408,448);ctx.moveTo(537,168);ctx.lineTo(552,448);ctx.stroke();
 const active=['ready','flight'].includes(g?.phase);ctx.strokeStyle=active?'#dcfa7c':'#f0ead077';ctx.lineWidth=4;ctx.shadowColor='#dcfa7c';ctx.shadowBlur=active?13:0;ctx.beginPath();ctx.moveTo(387,420);ctx.lineTo(573,420);ctx.stroke();ctx.shadowBlur=0;
 for(const y of [153,461]){for(const x of [470,480,490]){ctx.strokeStyle='#ffedb6';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y-25);ctx.stroke();}ctx.beginPath();ctx.moveTo(468,y-25);ctx.lineTo(492,y-25);ctx.stroke();}
 let lane=d?.easy?d.line:g?.role==='batter'?aim:0,angle=0;if(d?.shot){lane=d.shot.aim;const dt=t-d.shot.at;angle=dt>=0&&dt<400?-Math.sin(dt/400*Math.PI)*2.2:0;}
 person(480+lane*39,443,1.05,g?.settings.mode==='super'?characterFor(g.players.find(p=>p.id===g.batting)?.avatar).colour:'#daf477',true,angle);person(479,486,.75,'#d6e4b4');
 let bowlerY=137;if(d&&t<d.releaseAt)bowlerY=87+Math.max(0,1-(d.releaseAt-t)/1100)*50;person(480,bowlerY,.8,g?.settings.mode==='super'?characterFor(g.players.find(p=>p.id===g.bowling)?.avatar).colour:'#ed956c');

 if(g?.settings.mode==='super'){
  const batting=g.players.find(p=>p.id===g.batting),bowling=g.players.find(p=>p.id===g.bowling);
  ctx.textAlign='center';ctx.font='24px system-ui';if(batting)ctx.fillText(avatars[batting.avatar],480+lane*39,386);if(bowling)ctx.fillText(avatars[bowling.avatar],480,bowlerY-42);
  const power=d?.battingPower!=='none'&&d?.battingPower?d.battingPower:g.role==='batter'?batPower:'none';
  if(power!=='none'&&active){ctx.lineWidth=3;ellipse(480+lane*39,428,30,39,null,power==='shield'?'#ad9aff':power==='rally'?'#e6d176':power==='sidestep'?'#ffa96b':'#80f9ee');}
 }
 if(d&&['flight','result'].includes(g.phase)){
  const p=(t-d.releaseAt)/(d.impactAt-d.releaseAt),q=Math.max(0,Math.min(1,p));let bx=480+d.line*39*(d.type==='spin'?q*q*q:q)+bendOffset(d.bowlingPower,q,d.line),by=155+265*q;
  const bounce=.65,ballHeight=q<bounce?24*Math.sin(q/bounce*Math.PI):18*Math.sin((q-bounce)/(1-bounce)*Math.PI);
  if(p>=0&&p<=1.22&&g.phase==='flight'){ellipse(bx,by,5+q*2,2+q,'#041a1280');ellipse(bx,by-ballHeight,5+q*2,5+q*2,['curve','latebreak'].includes(d.bowlingPower)?'#c5a1ff':d.bowlingPower==='blaze'?'#ffce58':d.bowlingPower==='float'?'#80f9ee':'#ff785c','#ffe6ba');ctx.strokeStyle='#fff1d5';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(bx-2,by-ballHeight-4);ctx.lineTo(bx+2,by-ballHeight+4);ctx.stroke();}
  if(g.phase==='result'&&g.last.runs){const a=Math.min(1,(t-g.last.resolvedAt)/1400),dir=g.last.aim===0?.4:g.last.aim*1.1;const tx=480+Math.sin(dir)*390,ty=150;bx=480+(tx-480)*a;by=420+(ty-420)*a-(g.last.runs===6?140:35)*Math.sin(a*Math.PI);ellipse(bx,by,6,6,'#ffab77');}
 }
 ctx.fillStyle='#dcedbd';ctx.font='10px ui-sans-serif,system-ui';ctx.textAlign='center';for(const [i,label]of[[-1,'OFF'],[0,'STUMPS'],[1,'LEG']])ctx.fillText(label,480+i*58,528);
 const s=state?.game,del=s?.delivery;const target=del?.easy?del.target:75;const progress=del?(t-del.releaseAt)/(del.impactAt-del.releaseAt):0;
 $('timing-marker').style.left=Math.max(0,Math.min(100,progress*target))+'%';
 const easy=s?.settings.controls==='easy',flight=del?del.impactAt-del.releaseAt:1700,w=del?.timing||easyTiming(),windowMs=easy?w.hit:90,zoneWidth=windowMs/flight*target*2;
 $('contact-zone').hidden=!easy;$('contact-zone').style.left=(target-zoneWidth/2)+'%';$('contact-zone').style.width=zoneWidth+'%';const sweet=easy?w.six/flight*target*2:10;$('sweet-zone').style.left=(target-sweet/2)+'%';$('sweet-zone').style.width=sweet+'%';
 const rescueWidth=w.rescue/flight*target*2;$('rescue-zone').hidden=!easy||w.rescue<=w.hit;$('rescue-zone').style.left=(target-rescueWidth/2)+'%';$('rescue-zone').style.width=rescueWidth+'%';show('timing-detail',easy);
 const timingText='HIT WINDOW '+(w.hit*2)+' ms · SIX WINDOW '+(w.six*2)+' ms'+(del?.bowlingPower&&del.bowlingPower!=='none'?' · '+POWERS[del.bowlingPower].name+' −'+Math.round((1-w.bowlingScale)*100)+'%':'')+(w.readyPower&&w.readyPower!=='none'?' · '+POWERS[w.readyPower].name+(w.readyPower==='focus'?' +25%':w.readyPower==='sidestep'?' · amber rescue':w.readyPower==='rally'?' · singles become two':' · catch protection'):'');if($('timing-detail').textContent!==timingText)$('timing-detail').textContent=timingText;
 const rescueNow=s?.phase==='flight'&&del&&!del.shot&&!shotPending&&Math.abs(t-del.impactAt)>w.hit&&Math.abs(t-del.impactAt)<=w.rescue;
 const hitNow=s?.phase==='flight'&&del&&Math.abs(t-del.impactAt)<=w.hit&&!del.shot&&!shotPending;
 $('hit-cue').textContent=del?.shot||shotPending?'SHOT PLAYED':s?.phase!=='flight'||t<del.releaseAt?'GET READY':hitNow?'HIT NOW!':rescueNow?'SIDESTEP SAVE!':t>del.impactAt+w.rescue?'TOO LATE':'WAIT…';$('quick-hit').classList.toggle('hit-now',!!hitNow);
 $('swing').firstChild.textContent=del?.shot||shotPending?'SHOT PLAYED ':s?.phase==='ready'?'WAIT FOR THE BOWLER ':del&&t<del.releaseAt?'GET READY ':easy?'HIT ':'SWING ';
 $('swing').disabled=!s||s.role!=='batter'||s.phase!=='flight'||!del||!!del.shot||shotPending||!clockReady||t<del.releaseAt||t>del.impactAt+(del.easy?450:350);
 $('quick-hit').disabled=$('swing').disabled;$('quick-hit').firstChild.textContent=$('swing').firstChild.textContent;
 $('countdown').textContent=s?.deadline?Math.max(0,Math.ceil((s.deadline-t)/1000))+'s':'';
 requestAnimationFrame(()=>draw(serverTime()));
}
requestAnimationFrame(()=>draw(serverTime()));
