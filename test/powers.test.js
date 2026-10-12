import test from 'node:test';import assert from 'node:assert/strict';
import {create,act,tick,view,shotResult,DURATIONS} from '../game.js';
import {CHARACTERS,characterFor,bendOffset} from '../public/characters.js';
function game(mode='super',avatar=1){const g=create('a','Alice',avatar);act(g,'b','join',{name:'Bob',avatar});act(g,'a','settings',{overs:2,wickets:5,mode});act(g,'a','start',{},0);act(g,g.toss.winner,'toss',{choice:'bat'},1);return g;}
function bowl(g,power='none'){act(g,g.bowling,'bowl',{line:0,type:'pace',power},g.ballSerial*10000+100);return g.delivery;}
function swing(g,power='none'){const d=g.delivery;act(g,g.batting,'swing',{delivery:d.id,aim:0,kind:'drive',at:d.impactAt,power},d.impactAt);}
function end(g){tick(g,g.deadline);tick(g,g.deadline);}
const shot=(power,kind='loft',delta=110,aim=0)=>shotResult({line:0,impactAt:1000,roll:0,battingPower:power,shot:{aim,kind,at:1000+delta}});
test('Classic rejects powers without consuming a charge or a ball',()=>{const g=game('classic');assert.throws(()=>bowl(g,'blaze'),/Classic/);assert.equal(g.ballSerial,0);bowl(g);assert.throws(()=>swing(g,'focus'),/Classic/);assert.equal(g.delivery.shot,null);swing(g);assert.equal(shotResult(g.delivery).runs,4);});
test('Focus widens timing windows by 25%, keeps lane requirements and six-run cap',()=>{assert.equal(shot('none').runs,4);assert.equal(shot('focus').runs,6);assert.equal(shot('focus','loft',113).runs,4);assert.equal(shot('focus','loft',0,1).label,'BOWLED');assert.equal(shotResult({line:0,battingPower:'focus',shot:null}).label,'BOWLED');for(let delta=-350;delta<=350;delta++)assert.ok(shot('focus','loft',delta).runs<=6);});
test('Shield saves only a caught wicket, awards zero runs and cannot save the stumps',()=>{assert.equal(shot('none','loft',210).label,'CAUGHT');const saved=shot('shield','loft',210);assert.equal(saved.label,'SHIELD SAVE');assert.equal(saved.runs,0);assert.equal(saved.wicket,false);assert.equal(shot('shield','loft',0,1).label,'BOWLED');assert.equal(shotResult({line:0,battingPower:'shield',shot:null}).label,'BOWLED');});
test('Blaze shortens flight by 15%; Curve preserves the contact time and lane',()=>{for(const power of ['blaze','curve'])for(const type of Object.keys(DURATIONS)){const g=game('super',power==='curve'?0:1);act(g,g.bowling,'bowl',{line:1,type,power},100);const d=view(g,g.batting).delivery;assert.equal(d.impactAt-d.releaseAt,power==='blaze'?Math.max(1200,Math.round(DURATIONS[type]*.85)):DURATIONS[type]);assert.equal(d.line,1);assert.equal(d.bowlingPower,power);assert.equal(d.roll,undefined);}});
test('Powers share one charge per role per over and refresh without stacking',()=>{const g=game();bowl(g,'blaze');swing(g,'focus');end(g);assert.throws(()=>bowl(g,'blaze'),/recharges/);bowl(g);assert.throws(()=>swing(g,'focus'),/recharges/);swing(g);end(g);for(let i=2;i<6;i++){bowl(g);swing(g);end(g);}assert.equal(view(g,'a').powers.battingAvailable,true);assert.equal(view(g,'a').powers.bowlingAvailable,true);bowl(g,'blaze');swing(g,'focus');assert.equal(view(g,'a').powers.battingAvailable,false);assert.equal(view(g,'a').powers.bowlingAvailable,false);});
test('Both players get fresh identical budgets when innings swap',()=>{const g=game(),first=g.batting;for(let i=0;i<12;i++){bowl(g,i%6===0?'blaze':'none');swing(g,i%6===0?'focus':'none');end(g);}assert.equal(g.phase,'interval');tick(g,g.deadline);assert.notEqual(g.batting,first);assert.equal(view(g,'a').powers.battingAvailable,true);assert.equal(view(g,'a').powers.bowlingAvailable,true);bowl(g,'blaze');swing(g,'focus');});
test('Invalid, wrong-role and stale power requests do not spend charges',()=>{const g=game();assert.throws(()=>bowl(g,'focus'));bowl(g);assert.throws(()=>act(g,g.batting,'swing',{delivery:'old',power:'focus'},0));assert.throws(()=>swing(g,'blaze'));assert.equal(view(g,'a').powers.battingAvailable,true);swing(g,'focus');assert.throws(()=>swing(g,'shield'));});
test('All eight fixed kits are distinct, with identical charge budgets and Classic stats',()=>{
 assert.equal(new Set(CHARACTERS.map(c=>c.bat+'/'+c.bowl)).size,8);
 for(let avatar=0;avatar<8;avatar++){
  const c=characterFor(avatar),g=game('super',avatar);bowl(g,c.bowl);swing(g,c.bat);
  assert.equal(shotResult(g.delivery).runs,c.bat==='sidestep'?2:4);assert.equal(g.powerUse.bat,0);assert.equal(g.powerUse.bowl,0);
  const classic=game('classic',avatar);bowl(classic);swing(classic);assert.equal(shotResult(classic.delivery).runs,4);
 }
});
test('Only host can select mode and settings lock at toss',()=>{const g=create('a','Alice');act(g,'b','join',{name:'Bob'});assert.throws(()=>act(g,'b','settings',{overs:1,wickets:3,mode:'super'}));assert.throws(()=>act(g,'a','settings',{overs:1,wickets:3,mode:'unknown'}));act(g,'a','start',{},0);assert.throws(()=>act(g,'a','settings',{overs:1,wickets:3,mode:'super'}));});
test('Superpowers bot matches finish under the same charge rules',()=>{for(let i=0;i<8;i++){const g=create('a','Alice');act(g,'a','bot');act(g,'a','settings',{overs:1,wickets:1,mode:'super'});act(g,'a','start',{},0);for(let t=0;t<240000&&g.phase!=='finished';t+=50)tick(g,t);assert.equal(g.phase,'finished');}});

test('Avatars can change only in lobby; every kit rejects every unowned power',()=>{
 const g=create('a','Alice');act(g,'b','join',{name:'Bob'});act(g,'a','avatar',{avatar:7});assert.equal(g.players[0].avatar,7);assert.throws(()=>act(g,'a','avatar',{avatar:8}));act(g,'a','start',{},0);assert.throws(()=>act(g,'a','avatar',{avatar:0}));
 for(let avatar=0;avatar<8;avatar++){const h=game('super',avatar),kit=characterFor(avatar);
  for(const power of ['blaze','curve','float','latebreak'].filter(p=>p!==kit.bowl))assert.throws(()=>bowl(h,power),/kit/);
  assert.equal(h.powerUse.bowl,-1);bowl(h);
  for(const power of ['focus','shield','sidestep','rally'].filter(p=>p!==kit.bat))assert.throws(()=>swing(h,power),/kit/);
  assert.equal(h.powerUse.bat,-1);
 }
});
test('Sidestep fixes only a neighboring lane and caps all shots at two',()=>{
 assert.equal(shot('sidestep','loft',0,1).runs,2);assert.equal(shot('none','loft',0,1).label,'BOWLED');
 assert.equal(shot('sidestep','loft',0,0).runs,2);assert.equal(shot('sidestep','loft',300,1).label,'BOWLED');
 assert.equal(shotResult({line:1,impactAt:1000,roll:0,battingPower:'sidestep',shot:{aim:-1,kind:'loft',at:1000}}).label,'CAUGHT');
});
test('Rally rewards accurate defence only, leaving other shot types unchanged',()=>{
 assert.equal(shot('rally','defend',180).runs,2);assert.equal(shot('rally','defend',181).runs,0);assert.equal(shot('rally','defend',0,1).label,'BOWLED');
 for(const kind of ['drive','loft'])for(const delta of [0,110,180,250])assert.deepEqual(shot('rally',kind,delta),shot('none',kind,delta));
});
test('Float is 15% slower; both bends end at the advertised lane and remain visible',()=>{
 const g=game('super',2);const d=bowl(g,'float');assert.equal(d.impactAt-d.releaseAt,Math.round(DURATIONS.pace*1.15));
 for(const p of ['curve','latebreak'])for(const lane of [-1,0,1]){assert.ok(Math.abs(bendOffset(p,0,lane))<1e-10);assert.ok(Math.abs(bendOffset(p,1,lane))<1e-10);assert.notEqual(bendOffset(p,.75,lane),0);}
 assert.equal(bendOffset('latebreak',.4,0),0);assert.ok(bendOffset('curve',.4,0)>0);
});
test('Every avatar can complete both innings using its own powers',()=>{
 for(let avatar=0;avatar<8;avatar++){const g=game('super',avatar),kit=characterFor(avatar);for(let innings=0;innings<2;innings++){
  for(let i=0;i<12;i++){bowl(g,i%6===0?kit.bowl:'none');swing(g,i%6===0?kit.bat:'none');end(g);}
  if(g.phase==='interval')tick(g,g.deadline);
 }assert.equal(g.phase,'finished');assert.equal(g.result.tied,true);}
});
