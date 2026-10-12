// Shared by the server and client so displayed kits match enforced abilities.
export const POWERS={
 focus:{easyDescription:'Automatically widens timing windows by 25% when it would improve your hit.',name:'Focus',description:'25% wider timing windows for one swing. Still requires the correct lane.'},
 shield:{easyDescription:'Automatically saves a caught dismissal as a dot ball. Cannot protect the stumps.',name:'Shield',description:'A caught dismissal becomes a dot ball. Cannot save you from being bowled.'},
 sidestep:{easyDescription:'Adds a visible amber rescue zone 50% beyond the normal contact window, worth one run.',name:'Sidestep',description:'Corrects an aim one lane away, but caps this shot at two runs. Timing still matters.'},
 rally:{easyDescription:'Automatically turns a single into two runs.',name:'Rally',description:'A correctly aimed defence within 180 ms scores two instead of one. No help for drives or lofts.'},
 blaze:{easyDescription:'15% faster flight and a 10% narrower hitting window.',name:'Blaze',description:'15% shorter flight, never below 1.2 seconds. Same line and scoring rules.'},
 curve:{easyDescription:'A visible sideways bend and a 20% narrower hitting window.',name:'Curve',description:'A smooth sideways bend, visible throughout flight. Normal speed and landing lane.'},
 float:{easyDescription:'15% slower flight but a 20% narrower hitting window: wait, then be precise.',name:'Float',description:'15% longer flight to tempt an early swing. Gives a patient batter more reaction time.'},
 latebreak:{easyDescription:'A smaller late bend and a 25% narrower hitting window at normal speed.',name:'Late Break',description:'Bends in the second half of flight. Normal speed; visible warning and unchanged landing lane.'}
};
export const CHARACTERS=[
 {icon:'🦊',name:'Fox',personality:'The crafty improviser',bat:'sidestep',bowl:'curve',colour:'#ffa96b'},
 {icon:'🐯',name:'Tiger',personality:'The aggressive striker',bat:'focus',bowl:'blaze',colour:'#ffbc55'},
 {icon:'🐼',name:'Panda',personality:'The patient defender',bat:'shield',bowl:'float',colour:'#c7e4d8'},
 {icon:'🦁',name:'Lion',personality:'The composed captain',bat:'rally',bowl:'latebreak',colour:'#e6d176'},
 {icon:'🐧',name:'Penguin',personality:'The nimble accumulator',bat:'rally',bowl:'curve',colour:'#83d6f1'},
 {icon:'🦉',name:'Owl',personality:'The calculating tactician',bat:'focus',bowl:'float',colour:'#d6b4f4'},
 {icon:'🐲',name:'Dragon',personality:'The fearless attacker',bat:'shield',bowl:'blaze',colour:'#a4e887'},
 {icon:'🤖',name:'Robot',personality:'The adaptive technician',bat:'sidestep',bowl:'latebreak',colour:'#9bbfff'}
];
export const characterFor=avatar=>CHARACTERS[avatar]||CHARACTERS[0];
// A visible path effect only. Endpoint and contact time always match the server.
export function bendOffset(power,q,line){const direction=line===1?-1:1;if(power==='curve')return 55*Math.sin(Math.PI*q)*direction;if(power==='latebreak')return q<.5?0:40*Math.sin(Math.PI*(q-.5)*2)*direction;return 0;}

// Milliseconds either side of contact. The server scores and publishes these
// same thresholds for the timing display; powers never shift contact itself.
export function easyTiming(d={}){
 const bowlingScale={blaze:.9,curve:.8,float:.8,latebreak:.75}[d.bowlingPower]||1;
 const focus=d.battingPower==='focus'?1.25:1;
 const typeScale={pace:1,slower:.85,spin:.9}[d.type]||1;
 const band=n=>Math.round(n*typeScale*bowlingScale*focus);
 const hit=band(100);
 return {six:band(30),four:band(55),two:d.battingPower==='rally'?hit:band(80),hit,rescue:d.battingPower==='sidestep'?Math.round(hit*1.5):hit,bowlingScale,typeScale};
}
