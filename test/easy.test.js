import test from 'node:test';import assert from 'node:assert/strict';import {create,act,tick,shotResult,view} from '../game.js';
function match(mode='classic',avatar=0){const g=create('a','Alice',avatar);act(g,'b','join',{name:'Bob',avatar});act(g,'a','settings',{overs:2,wickets:5,mode});act(g,'a','start',{},0);act(g,g.toss.winner,'toss',{choice:'bat'},1);return g;}
function ball(g){act(g,g.bowling,'bowl',{line:0,type:'pace'},g.ballSerial*10000+100);return g.delivery;}
function hit(g,delta){const d=g.delivery,at=d.impactAt+delta;act(g,g.batting,'swing',{delivery:d.id,at},at);return shotResult(g.delivery);}
function end(g){tick(g,g.deadline);tick(g,g.deadline);}
test('Easy is default and a single timestamped hit needs no lane, shot or power controls',()=>{const g=match();assert.equal(g.settings.controls,'easy');const d=ball(g);assert.equal(d.impactAt-d.releaseAt,1700);assert.equal(hit(g,0).runs,6);assert.equal(d.shot.aim,d.line);assert.equal(d.shot.kind,'auto');assert.equal(view(g,'a').delivery.easy,true);});
test('Easy scoring accepts a 0.2 second contact window across all lanes',()=>{for(const line of [-1,0,1])for(const [delta,runs]of[[-100,1],[-80,2],[-55,4],[-30,6],[0,6],[30,6],[55,4],[80,2],[100,1]]){const g=match();ball(g);g.delivery.line=line;assert.equal(hit(g,delta).runs,runs);}});
test('Easy still rejects duplicates, stale IDs, wrong players and forged clocks',()=>{const g=match(),d=ball(g);const data={delivery:d.id,at:d.impactAt};assert.throws(()=>act(g,g.bowling,'swing',data,d.impactAt));assert.throws(()=>act(g,g.batting,'swing',{...data,delivery:'stale'},d.impactAt));assert.throws(()=>act(g,g.batting,'swing',data,d.impactAt+221));hit(g,0);assert.throws(()=>hit(g,0));});
test('Bad timing and no input can still take wickets; early error offers timing help',()=>{const g=match();ball(g);assert.equal(hit(g,-700).label,'BOWLED');assert.match(shotResult(g.delivery).feedback,/HIT NOW/);const h=match();ball(h);tick(h,h.deadline);assert.equal(h.last.label,'BOWLED');});
test('Each automatic batting ability helps at its intended timing, once per over',()=>{for(const [avatar,delta,runs]of[[1,32,6],[0,110,1],[3,68,2]]){const g=match('super',avatar);ball(g);assert.equal(hit(g,delta).runs,runs);assert.notEqual(g.delivery.battingPower,'none');end(g);ball(g);hit(g,delta);assert.equal(g.delivery.battingPower,'none');}
 const g=match('super',2);ball(g);g.delivery.line=1;g.delivery.roll=0;const r=hit(g,400);assert.equal(r.wicket,false);assert.equal(r.label,'SHIELD SAVE');});
test('Automatic powers conserve batting charge when it would not help and bowl once per over',()=>{const g=match('super',1);ball(g);assert.equal(g.delivery.bowlingPower,'blaze');hit(g,0);assert.equal(g.delivery.battingPower,'none');end(g);for(let i=1;i<6;i++){ball(g);assert.equal(g.delivery.bowlingPower,'none');hit(g,0);end(g);}ball(g);assert.equal(g.delivery.bowlingPower,'blaze');});
test('Controls are shared match settings and cannot change after the toss',()=>{const g=match();assert.throws(()=>act(g,'a','settings',{overs:2,wickets:5,controls:'manual'}));});

test('The narrower scoring bands reject hits just beyond their thresholds',()=>{for(const [delta,runs] of [[31,4],[56,2],[81,1],[101,0],[-101,0]]){const g=match();ball(g);assert.equal(hit(g,delta).runs,runs);}});

test('Focus display matches scoring before the swing and disappears after charge consumption',()=>{
 const g=match('super',1);ball(g);const w=view(g,g.batting).delivery.timing;assert.equal(w.readyPower,'focus');assert.equal(w.hit,113);assert.equal(w.six,34);assert.equal(hit(g,32).runs,6);end(g);ball(g);const next=view(g,g.batting).delivery.timing;assert.equal(next.readyPower,'none');assert.equal(next.hit,100);assert.equal(next.six,30);
});
test('Every bowling power narrows the actual scoring window and the published window identically',()=>{
 for(const [power,hitWindow]of[['blaze',90],['curve',80],['float',80],['latebreak',75]]){
  const g=match();ball(g);g.delivery.bowlingPower=power;const w=view(g,g.batting).delivery.timing;assert.equal(w.hit,hitWindow);
  const base={...g.delivery,shot:{aim:0,kind:'auto',at:g.delivery.impactAt+hitWindow}};assert.equal(shotResult(base).runs,1);base.shot.at++;assert.equal(shotResult(base).runs,0);
 }
});
test('Sidestep rescue zone matches scoring and disappears after use',()=>{
 const g=match('super',0);ball(g);const w=view(g,g.batting).delivery.timing;assert.equal(w.hit,80);assert.equal(w.rescue,120);assert.equal(hit(g,120).runs,1);end(g);ball(g);const next=view(g,g.batting).delivery.timing;assert.equal(next.rescue,next.hit);
});
test('Shield and Rally do not enlarge the contact window',()=>{
 for(const avatar of [2,3]){const g=match('super',avatar);ball(g);const w=view(g,g.batting).delivery.timing;assert.equal(w.rescue,w.hit);assert.equal(w.hit,avatar===2?80:75);}
});

test('The server moves the timing target each delivery, keeps it in bounds, and publishes it',()=>{const g=match();let previous=null;for(let i=0;i<10;i++){ball(g);const d=view(g,g.batting).delivery;assert.ok([35,45,55,65,75,85].includes(d.target));assert.notEqual(d.target,previous);previous=d.target;assert.equal(hit(g,0).runs,6);end(g);}});
test('Bowler delivery choices produce distinct flights and timing thresholds',()=>{for(const [type,duration,window]of[['pace',1700,100],['slower',2400,85],['spin',2000,90]]){const g=match();act(g,g.bowling,'bowl',{line:0,type},100);const d=view(g,g.batting).delivery;assert.equal(d.type,type);assert.equal(d.impactAt-d.releaseAt,duration);assert.equal(d.timing.hit,window);assert.equal(hit(g,window).runs,1);}});
