const {test}=require('node:test');
const assert=require('node:assert/strict');
const stack=require('../games/stack-attack/engine.js');
const golf=require('../games/tiny-golf/engine.js');
test('stack overlap cuts the correct edge and misses end the run',()=>{
 const base={x:100,width:200};
 assert.deepEqual(stack.landing(base,{x:140,width:200}),{x:140,width:160,perfect:false,cut:{x:300,width:40}});
 assert.deepEqual(stack.landing(base,{x:60,width:200}),{x:100,width:160,perfect:false,cut:{x:60,width:40}});
 assert.equal(stack.landing(base,{x:310,width:200}),null);
 assert.equal(stack.landing(base,{x:-101,width:200}),null);
});
test('perfect placements preserve width at tolerance boundaries',()=>{
 const base={x:100,width:200};for(const x of [93,100,107])assert.deepEqual(stack.landing(base,{x,width:200}),{x:100,width:200,perfect:true,cut:null});
 assert.equal(stack.landing(base,{x:108,width:200}).width,192);
});
test('golf wall collisions reflect without allowing tunneling',()=>{
 const ball={x:295,y:240,vx:0,vy:700};for(let i=0;i<10;i++)golf.step(ball,golf.holes[5],1/120,0);
 assert.ok(ball.y<270);assert.ok(ball.vy<0);
 const inside={x:100,y:100,vx:30,vy:0};assert.ok(golf.collideRect(inside,{x:90,y:90,w:40,h:40}));assert.ok(inside.x<=80||inside.x>=140||inside.y<=80||inside.y>=140);
});
test('putts sink at a playable speed and cannot be shot twice in motion',()=>{
 const ball={x:300,y:480,vx:0,vy:0};assert.equal(golf.shoot(ball,-Math.PI/2,.8),true);assert.equal(golf.shoot(ball,0,.5),false);
 for(let i=0;i<1000&&!ball.sunk;i++)golf.step(ball,golf.holes[0],1/120,i/120);
 assert.equal(ball.sunk,true);assert.equal(ball.x,300);assert.equal(ball.y,110);
});
test('sand slows the ball and boundaries retain it on the course',()=>{
 const normal={x:220,y:230,vx:180,vy:0},sand={...normal};golf.step(normal,golf.holes[0],1/120,0);golf.step(sand,golf.holes[3],1/120,0);assert.ok(sand.vx<normal.vx);
 const edge={x:549,y:500,vx:600,vy:0};golf.step(edge,golf.holes[0],1/120,0);assert.ok(edge.x<=550);assert.ok(edge.vx<0);
});
test('portals move the ball across the divider and apply a cooldown',()=>{
 const b={x:150,y:398,vx:0,vy:-150};golf.step(b,golf.holes[4],1/120,0);assert.equal(b.x,440);assert.ok(b.y<190);assert.ok(b.portalCooldown>0);
});
test('each course has a valid tee, cup, and collision geometry',()=>{
 assert.equal(golf.holes.length,6);
 for(const h of golf.holes){for(const point of [h.start,h.cup]){assert.ok(point.every(x=>x>=50&&x<=550));for(const r of h.walls)assert.ok(!(point[0]>r.x-10&&point[0]<r.x+r.w+10&&point[1]>r.y-10&&point[1]<r.y+r.h+10));}assert.ok(h.par>=2);}
});
test('all six courses can be completed using real putts and physics',()=>{
 const plans=[[[-90,75]],[[-90,65],[-30,75]],[[-50,95]],[[-105,80],[-20,85]],[[-100,30]],[[-170,50],[-135,95]]];
 plans.forEach((shots,index)=>{
  const hole=golf.holes[index],ball={x:hole.start[0],y:hole.start[1],vx:0,vy:0};let clock=0;
  for(const [angle,power]of shots){assert.ok(golf.shoot(ball,angle*Math.PI/180,power/100));let frames=0;while((ball.vx||ball.vy)&&!ball.sunk&&frames<1800){golf.step(ball,hole,1/120,clock);clock+=1/120;frames++;}assert.ok(frames<1800);}
  assert.equal(ball.sunk,true,`Hole ${index+1}: ${hole.name}`);
 });
});
