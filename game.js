import {CHARACTERS,characterFor,easyTiming} from './public/characters.js';
import {randomInt,randomUUID} from 'node:crypto';
export const AVATARS=CHARACTERS.map(c=>c.icon);
export const DURATIONS={pace:1450,slower:2050,spin:1800};
export function player(id,name,avatar=0,bot=false){return {id,name:String(name||'Player').trim().slice(0,24)||'Player',avatar:Number.isInteger(avatar)&&avatar>=0&&avatar<AVATARS.length?avatar:0,bot,wins:0};}
export function create(id,name,avatar){return {host:id,players:[player(id,name,avatar)],spectators:[],settings:{overs:2,wickets:3,mode:'classic',controls:'easy'},phase:'lobby',deadline:null,innings:0,batting:null,bowling:null,scores:[],delivery:null,last:null,toss:null,result:null,match:0,ballSerial:0,powerUse:{bat:-1,bowl:-1},log:['Welcome to the crease. Invite an opponent or add the practice bot.']};}
const log=(g,s)=>{g.log=[...g.log.slice(-29),s];};
const member=(g,id)=>g.players.find(p=>p.id===id);
const other=(g,id)=>g.players.find(p=>p.id!==id);
export function legalOvers(balls){return `${Math.floor(balls/6)}.${balls%6}`;}
function startInnings(g,batting,now){g.innings++;g.powerUse={bat:-1,bowl:-1};g.batting=batting;g.bowling=other(g,batting).id;g.scores.push({player:batting,runs:0,wickets:0,balls:0,fours:0,sixes:0,history:[]});ready(g,now);log(g,`${member(g,batting).name} is batting in innings ${g.innings}.`);}
function ready(g,now){g.phase='ready';g.deadline=now+20000;g.delivery=null;g.botBowlAt=now+1500;}
export function powerStatus(g){const over=Math.floor((g.scores.at(-1)?.balls||0)/6);return {enabled:g.settings.mode==='super',over:over+1,battingAvailable:g.settings.mode==='super'&&g.powerUse.bat!==over,bowlingAvailable:g.settings.mode==='super'&&g.powerUse.bowl!==over};}
function usePower(g,role,power){
 const owner=member(g,role==='bat'?g.batting:g.bowling);
 const allowed=['none',characterFor(owner?.avatar)[role]];
 if(!allowed.includes(power))throw Error("That power is not in your avatar's kit.");
 if(power==='none')return;
 const status=powerStatus(g);if(!status.enabled)throw Error('Powers are disabled in Classic mode.');
 if(!(role==='bat'?status.battingAvailable:status.bowlingAvailable))throw Error('Your power recharges next over.');
 g.powerUse[role]=status.over-1;
}
function botPower(g,role){const status=powerStatus(g),available=role==='bat'?status.battingAvailable:status.bowlingAvailable;if(!available)return 'none';if((g.scores.at(-1).balls%6)===5||randomInt(100)<35)return characterFor(member(g,role==='bat'?g.batting:g.bowling).avatar)[role];return 'none';}
function bowl(g,line,type,now,power='none'){
 if(g.settings.controls==='easy')power=automaticPower(g,'bowl');
 usePower(g,'bowl',power);const base=g.settings.controls==='easy'?{pace:1700,slower:2400,spin:2000}[type]:DURATIONS[type];const duration=power==='blaze'?Math.max(1200,Math.round(base*.85)):power==='float'?Math.round(base*1.15):base;
 const targets=[35,45,55,65,75,85].filter(n=>n!==g.lastTarget);const target=targets[randomInt(targets.length)];g.lastTarget=target;
 g.ballSerial++;g.delivery={id:randomUUID(),serial:g.ballSerial,target,line,type,bowlingPower:power,battingPower:'none',easy:g.settings.controls==='easy',releaseAt:now+1100,impactAt:now+1100+duration,shot:null,roll:randomInt(100)};g.phase='flight';g.deadline=g.delivery.impactAt+(g.delivery.easy?700:550);
 if(power!=='none')log(g,`${member(g,g.bowling).name} activated ${power.toUpperCase()}.`);
 if(member(g,g.batting).bot){const jitter=Math.round(randomInt(g.delivery.easy?-140:-180,g.delivery.easy?141:181)*(['blaze','float'].includes(power)?1.1:1)),aim=randomInt(100)<(['curve','latebreak'].includes(power)?70:78)?line:randomInt(-1,2);g.botShot={at:g.delivery.impactAt+jitter,aim,kind:randomInt(100)<35?'loft':'drive',power:botPower(g,'bat')};}else g.botShot=null;
}
export function shotResult(d){
 if(d.easy)return easyResult(d);

 let effective=d;
 if(d.battingPower==='sidestep'&&d.shot&&Math.abs(d.shot.aim-d.line)===1)effective={...d,shot:{...d.shot,aim:d.line}};
 const result=baseShotResult(effective);
 if(d.battingPower==='sidestep'&&result.runs>2)return {...result,runs:2,label:'TWO RUNS',feedback:'Sidestep keeps the shot controlled. Maximum two runs.'};
 if(d.battingPower==='rally'&&d.shot?.kind==='defend'&&result.runs===1)return {...result,runs:2,label:'RALLY TWO',feedback:'Quick feet turn a well-timed defence into two runs.'};if(d.battingPower==='shield'&&result.wicket&&result.label==='CAUGHT')return {...result,runs:0,wicket:false,label:'SHIELD SAVE',feedback:'Shield deflected the catch. A dot ball; no runs.'};return result;}
function easyResult(d){
 if(!d.shot)return {runs:0,wicket:d.line===0,label:d.line===0?'BOWLED':'DOT BALL',feedback:'No hit this ball. Tap once when the indicator turns green.'};
 const timing=d.shot.at-d.impactAt,raw=Math.abs(timing),w=easyTiming(d);
 let runs=raw<=w.six?6:raw<=w.four?4:raw<=w.two?2:raw<=w.hit?1:0;
 if(d.battingPower==='sidestep'&&raw>w.hit&&raw<=w.rescue)runs=1;
 if(d.battingPower==='rally'&&runs===1)runs=2;
 const wicket=!runs&&(d.line===0||d.roll<35),caught=wicket&&d.line!==0;
 if(caught&&d.battingPower==='shield')return {runs:0,wicket:false,label:'SHIELD SAVE',feedback:'Shield saved a catch. Try hitting when the indicator turns green.',timing};
 return {runs,wicket,label:wicket?(caught?'CAUGHT':'BOWLED'):runs===6?'SIX!':runs===4?'FOUR!':runs===2?'TWO RUNS':runs===1?'SINGLE':'DOT BALL',feedback:runs?(runs>=4?'Great timing!':timing<0?'You connected! Wait a little longer for a boundary.':'You connected! Tap a little earlier for a boundary.'):timing<0?'Too early. Wait until HIT NOW appears.':'Too late. Tap as soon as HIT NOW appears.',timing};
}
function automaticPower(g,role,shot){
 const status=powerStatus(g);if(!(role==='bat'?status.battingAvailable:status.bowlingAvailable))return 'none';
 const power=characterFor(member(g,role==='bat'?g.batting:g.bowling).avatar)[role];
 if(role==='bowl')return power;
 const d={...g.delivery,shot,battingPower:'none'},base=shotResult(d),boost=shotResult({...d,battingPower:power});
 return boost.runs>base.runs||base.wicket&&!boost.wicket?power:'none';
}
function baseShotResult(d){
 const shot=d.shot;if(!shot)return {runs:0,wicket:d.line===0,label:d.line===0?'BOWLED':'DOT BALL',feedback:d.line===0?'No shot. The ball hit the stumps.':'Left alone. No run.'};
 const error=shot.at-d.impactAt,abs=Math.abs(error)/(d.battingPower==='focus'?1.25:1),aligned=shot.aim===d.line;
 if(!aligned||abs>280){const wicket=d.line===0||shot.kind==='loft'&&d.roll<35;return {runs:0,wicket,label:wicket?(d.line===0?'BOWLED':'CAUGHT'):'DOT BALL',feedback:!aligned?'Wrong lane. Follow the ball into the crease.':error<0?'Too early. Wait for the ball.':'Too late. Swing at the contact line.',timing:error};}
 if(shot.kind==='defend')return {runs:abs<=180?1:0,wicket:false,label:abs<=180?'SINGLE':'DEFENDED',feedback:'Controlled defence. Low risk, low reward.',timing:error};
 if(shot.kind==='loft'){
  if(abs<=90)return {runs:6,wicket:false,label:'SIX!',feedback:'Middle of the bat. Over the rope.',timing:error};
  if(abs<=155)return {runs:4,wicket:false,label:'FOUR!',feedback:'Well timed. One bounce to the boundary.',timing:error};
  if(d.roll<65)return {runs:0,wicket:true,label:'CAUGHT',feedback:'Mistimed loft. A fielder takes it.',timing:error};
  return {runs:1,wicket:false,label:'SINGLE',feedback:'A top edge lands safely.',timing:error};
 }
 return {runs:abs<=105?4:abs<=180?2:1,wicket:false,label:abs<=105?'FOUR!':abs<=180?'TWO RUNS':'SINGLE',feedback:abs<=105?'Sweet timing. Through the gap.':error<0?'A little early. Runs on the board.':'A little late. Runs on the board.',timing:error};
}
function finish(g){const [a,b]=g.scores;const winner=a.runs===b.runs?null:a.runs>b.runs?a.player:b.player;g.result={winner,tied:!winner,text:!winner?'Match tied':winner===b.player?`${member(g,winner).name} wins with ${g.settings.wickets-b.wickets} wickets remaining`:`${member(g,winner).name} wins by ${a.runs-b.runs} run${a.runs-b.runs===1?'':'s'}`};if(winner)member(g,winner).wins++;g.phase='finished';g.deadline=null;log(g,g.result.text);}
function resolve(g,now){const r=shotResult(g.delivery),s=g.scores.at(-1);s.balls++;s.runs+=r.runs;if(r.wicket)s.wickets++;if(r.runs===4)s.fours++;if(r.runs===6)s.sixes++;g.last={...r,ball:s.balls,innings:g.innings,aim:g.delivery.shot?.aim??g.delivery.line,kind:g.delivery.shot?.kind||'drive',resolvedAt:now};s.history.push(r.wicket?'W':String(r.runs));g.phase='result';g.deadline=now+3400;log(g,`${legalOvers(s.balls)} · ${r.label} · ${s.runs}/${s.wickets}`);}
export function tick(g,now){
 if(g.phase==='toss'&&now>=g.deadline){const winner=g.toss.winner;log(g,'Toss choice timed out. The winner bats first.');startInnings(g,winner,now);return true;}
 if(g.phase==='ready'&&(now>=g.deadline||member(g,g.bowling).bot&&now>=g.botBowlAt)){bowl(g,randomInt(-1,2),Object.keys(DURATIONS)[randomInt(3)],now,member(g,g.bowling).bot?botPower(g,'bowl'):'none');return true;}
 if(g.phase==='flight'){
  if(g.botShot&&now>=g.botShot.at&&!g.delivery.shot){g.delivery.shot={at:g.botShot.at,aim:g.delivery.easy?g.delivery.line:g.botShot.aim,kind:g.delivery.easy?'auto':g.botShot.kind};const power=g.delivery.easy?automaticPower(g,'bat',g.delivery.shot):g.botShot.power;usePower(g,'bat',power);g.delivery.battingPower=power;}
  if(now>=g.deadline){resolve(g,now);return true;}
 }
 if(g.phase==='result'&&now>=g.deadline){const s=g.scores.at(-1),ended=s.balls>=g.settings.overs*6||s.wickets>=g.settings.wickets;
  if(g.innings===2&&(ended||s.runs>g.scores[0].runs)){finish(g);return true;}
  if(ended){g.phase='interval';g.deadline=now+8000;log(g,`Innings break. Target: ${s.runs+1}.`);}else ready(g,now);return true;
 }
 if(g.phase==='interval'&&now>=g.deadline){startInnings(g,g.bowling,now);return true;}
 return false;
}
export function act(g,id,action,data={},now=Date.now()){
 const p=member(g,id),spectator=g.spectators.find(p=>p.id===id);
 if(action==='join'){
  if(p||spectator)return;
  if(g.players.length<2&&g.phase==='lobby'&&data.seat!=='spectator')g.players.push(player(id,data.name,data.avatar));
  else {if(g.spectators.length>=8)throw Error('Spectator seats are full.');g.spectators.push(player(id,data.name,data.avatar));}return;
 }
 if(!p)throw Error('Only seated players can do that.');
 if(['settings','bot','removeBot','start','rematch'].includes(action)&&id!==g.host)throw Error('Only the room host can do that.');
 if(action==='avatar'){if(g.phase!=='lobby')throw Error('Avatars are locked until the next lobby.');if(!Number.isInteger(data.avatar)||data.avatar<0||data.avatar>=AVATARS.length)throw Error('Choose a valid avatar.');p.avatar=data.avatar;return;}
 if(action==='settings'){if(g.phase!=='lobby')throw Error('Settings are locked during a match.');if(![1,2,5].includes(data.overs)||![1,3,5].includes(data.wickets)||!['classic','super'].includes(data.mode??g.settings.mode)||!['easy','manual'].includes(data.controls??g.settings.controls))throw Error('Invalid match settings.');g.settings={overs:data.overs,wickets:data.wickets,mode:data.mode??g.settings.mode,controls:data.controls??g.settings.controls};return;}
 if(action==='bot'){if(g.phase!=='lobby'||g.players.length!==1)throw Error('A free opponent seat is required.');g.players.push(player('bot','Nets Bot',randomInt(AVATARS.length),true));return;}
 if(action==='removeBot'){if(g.phase!=='lobby')throw Error('Wait for a new match.');g.players=g.players.filter(p=>!p.bot);return;}
 if(action==='rematch'){if(g.phase!=='finished')throw Error('Finish this match first.');g.phase='lobby';g.deadline=null;g.result=null;g.last=null;g.delivery=null;return;}
 if(action==='start'){
  if(g.phase!=='lobby'||g.players.length!==2)throw Error('Two players or one player and a bot are required.');g.match++;g.innings=0;g.scores=[];g.result=null;g.last=null;g.delivery=null;g.toss={winner:g.players[randomInt(2)].id};g.phase='toss';g.deadline=now+15000;
  log(g,`${member(g,g.toss.winner).name} wins the toss.`);if(member(g,g.toss.winner).bot)startInnings(g,randomInt(2)?g.toss.winner:other(g,g.toss.winner).id,now);return;
 }
 if(action==='toss'){if(g.phase!=='toss'||id!==g.toss.winner)throw Error('It is not your toss choice.');if(!['bat','bowl'].includes(data.choice))throw Error('Choose bat or bowl.');startInnings(g,data.choice==='bat'?id:other(g,id).id,now);return;}
 if(action==='bowl'){if(g.phase!=='ready'||id!==g.bowling)throw Error('It is not your turn to bowl.');if(![-1,0,1].includes(data.line)||!Object.hasOwn(DURATIONS,data.type))throw Error('Choose a line and delivery type.');bowl(g,data.line,data.type,now,data.power??'none');return;}
 if(action==='swing'){
  if(g.phase!=='flight'||id!==g.batting||data.delivery!==g.delivery.id)throw Error('That ball is no longer playable.');if(g.delivery.shot)throw Error('One shot per delivery.');
  if(!g.delivery.easy&&(![-1,0,1].includes(data.aim)||!['defend','drive','loft'].includes(data.kind)))throw Error('Choose a batting lane and shot.');
  // Bound the client clock estimate; the server owns scoring and delivery timing.
  if(!Number.isFinite(data.at)||data.at<now-220||data.at>now+80)throw Error('Timing out of sync. Wait for the next ball.');
  const at=Math.min(now,data.at);if(at<g.delivery.releaseAt||at>g.delivery.impactAt+(g.delivery.easy?450:350))throw Error('Swing while the ball is live.');
  const shot={at,aim:g.delivery.easy?g.delivery.line:data.aim,kind:g.delivery.easy?'auto':data.kind};const power=g.delivery.easy?automaticPower(g,'bat',shot):data.power??'none';usePower(g,'bat',power);g.delivery.battingPower=power;g.delivery.shot=shot;if(g.delivery.battingPower!=='none')log(g,`${p.name} activated ${g.delivery.battingPower.toUpperCase()}.`);return;
 }
 throw Error('Unknown action.');
}
function previewTiming(g){
 const d=g.delivery;if(!d?.easy)return undefined;
 const readyPower=!d.shot&&powerStatus(g).battingAvailable?characterFor(member(g,g.batting).avatar).bat:d.battingPower;
 return {...easyTiming({...d,battingPower:readyPower}),readyPower};
}
export function view(g,id){return {host:g.host,players:g.players,spectators:g.spectators,settings:g.settings,powers:powerStatus(g),phase:g.phase,deadline:g.deadline,innings:g.innings,batting:g.batting,bowling:g.bowling,scores:g.scores,last:g.last,toss:g.toss,result:g.result,match:g.match,log:g.log,delivery:g.delivery?{id:g.delivery.id,serial:g.delivery.serial,target:g.delivery.target,easy:g.delivery.easy,timing:previewTiming(g),line:g.delivery.line,type:g.delivery.type,bowlingPower:g.delivery.bowlingPower,battingPower:g.delivery.battingPower,releaseAt:g.delivery.releaseAt,impactAt:g.delivery.impactAt,shot:g.delivery.shot}:null,you:id,role:id===g.batting?'batter':id===g.bowling?'bowler':'spectator'};}
