(() => {
  const {holes,step,shoot,rectAt}=GolfEngine;
  const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
  let phase='ready',index=0,ball,strokes=0,scores=[],angle=-Math.PI/2,power=.65,drag=null,last=performance.now(),clock=0,accumulator=0,wasMoving=false,trail=[],sinkTime=0;
  function mode(value){phase=value;document.body.dataset.state=value;$('pause').disabled=value==='ready'||value==='finished'||value==='between';controls();}
  function announce(text){$('status').textContent=text;}
  function controls(){const disabled=phase!=='playing'||!ball||ball.sunk||Math.hypot(ball.vx,ball.vy)>0;$('shoot').disabled=disabled;$('angle').disabled=disabled;$('power').disabled=disabled;$('angle').value=Math.round(angle*180/Math.PI);$('power').value=Math.round(power*100);$('angle-value').textContent=Math.round(angle*180/Math.PI)+'°';$('power-value').textContent=Math.round(power*100)+'%';if(ball)canvas.setAttribute('aria-label',`Hole ${index+1}: ${holes[index].name}. Ball at ${Math.round(ball.x)}, ${Math.round(ball.y)}; cup at ${holes[index].cup.join(', ')} on a 600 by 600 course. Drag back and release to shoot, or use the aim and power controls.`);}
  function resetHole(){const hole=holes[index];ball={x:hole.start[0],y:hole.start[1],vx:0,vy:0,sunk:false,portalCooldown:0};strokes=0;angle=-Math.PI/2;power=.65;drag=null;trail=[];sinkTime=0;wasMoving=false;clock=0;accumulator=0;$('hole-number').textContent=`${index+1} / ${holes.length}`;$('strokes').textContent='0';$('par').textContent=hole.par;$('overlay').hidden=true;$('scorecard').hidden=true;mode('playing');last=performance.now();announce(`${hole.name}. ${hole.tip}`);}
  function startRound(){index=0;scores=[];resetHole();}
  function showOverlay(title,copy,label,kicker){$('overlay-title').textContent=title;$('overlay-copy').textContent=copy;$('start').textContent=label;$('overlay-kicker').textContent=kicker;$('overlay').hidden=false;}
  function pause(){if(phase==='playing'){drag=null;mode('paused');showOverlay('The green can wait.','Take a moment. Your next shot will be here.','Back to the green →','ON PAUSE');announce('Game paused.');}else if(phase==='paused'){mode('playing');$('overlay').hidden=true;last=performance.now();accumulator=0;}}
  function putt(){if(phase!=='playing')return;if(shoot(ball,angle,power)){strokes++;$('strokes').textContent=strokes;wasMoving=true;trail=[];controls();announce('Rolling…');}}
  function complete(){
    scores[index]=strokes;mode('between');drag=null;
    const delta=strokes-holes[index].par,name=strokes===1?'Hole in one!':delta<0?'A little under par.':delta===0?'Right on the money.':'Nicely done.';
    announce(`Hole ${index+1} complete in ${strokes} stroke${strokes===1?'':'s'}.`);
    if(index===holes.length-1){mode('finished');const total=scores.reduce((a,b)=>a+b,0),par=holes.reduce((a,h)=>a+h.par,0);showOverlay('That’s a lovely round.',`${total} strokes over ${holes.length} holes. ${total<=par?'You beat the course.':'Every round teaches you a new angle.'}`,'Another round? →',`TOTAL ${total} · PAR ${par}`);$('scorecard').innerHTML=scores.map((s,i)=>`<div><span>HOLE ${i+1}</span><b>${s}</b><small>par ${holes[i].par}</small></div>`).join('');$('scorecard').hidden=false;}
    else showOverlay(name,`${strokes} stroke${strokes===1?'':'s'} on ${holes[index].name}. Next up: ${holes[index+1].name}.`,'Next hole →',`HOLE ${index+1} COMPLETE`);
  }
  function pointer(e){const rect=canvas.getBoundingClientRect();const size=Math.min(rect.width,rect.height),left=rect.left+(rect.width-size)/2,top=rect.top+(rect.height-size)/2;return{x:(e.clientX-left)*600/size,y:(e.clientY-top)*600/size};}
  canvas.addEventListener('pointerdown',e=>{if(phase!=='playing'||ball.sunk||ball.vx||ball.vy)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);drag={...pointer(e),id:e.pointerId,moved:false};});
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const p=pointer(e),dx=drag.x-p.x,dy=drag.y-p.y,d=Math.hypot(dx,dy);if(d>7){angle=Math.atan2(dy,dx);power=Math.min(1,Math.max(.1,d/175));drag.moved=true;controls();}});
  canvas.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(moved)putt();});
  canvas.addEventListener('pointercancel',()=>{drag=null;});canvas.addEventListener('lostpointercapture',()=>{drag=null;});
  function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function draw(){
    const hole=holes[index];ctx.fillStyle='#183d31';ctx.fillRect(0,0,600,600);
    ctx.fillStyle='#204c3a';for(let i=0;i<16;i++){ctx.beginPath();ctx.arc((i*151+20)%600,(i*87+15)%600,8+i%4*5,0,Math.PI*2);ctx.fill();}
    rounded(30,33,540,538,24,'#0c2d24');rounded(34,34,532,532,20,'#b1cda3');rounded(40,40,520,520,15,'#4d966a');
    ctx.save();ctx.beginPath();ctx.roundRect(40,40,520,520,15);ctx.clip();ctx.fillStyle='#ffffff06';for(let y=40;y<560;y+=70)ctx.fillRect(40,y,520,35);ctx.restore();
    for(const r of hole.sand||[]){rounded(r.x+2,r.y+3,r.w,r.h,22,'#30613f44');rounded(r.x,r.y,r.w,r.h,22,'#dbc790');ctx.fillStyle='#91764433';for(let j=0;j<60;j++){ctx.beginPath();ctx.arc(r.x+12+(j*57)%(r.w-24),r.y+12+(j*71)%(r.h-24),1.2,0,Math.PI*2);ctx.fill();}}
    for(const rect of hole.walls){const r=rectAt(rect,clock);rounded(r.x+3,r.y+5,r.w,r.h,5,'#214c3e55');rounded(r.x,r.y,r.w,r.h,5,rect.move?'#ead088':'#d8e1b2');ctx.fillStyle='#ffffff35';ctx.fillRect(r.x+4,r.y+3,r.w-8,4);}
    for(const [x,y,r] of hole.bumpers||[]){ctx.beginPath();ctx.arc(x+2,y+4,r,0,Math.PI*2);ctx.fillStyle='#133b3266';ctx.fill();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle='#e7af75';ctx.fill();ctx.strokeStyle='#ffdeb0';ctx.lineWidth=4;ctx.stroke();ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fillStyle='#be864e';ctx.fill();}
    (hole.portals||[]).forEach(([x,y],i)=>{ctx.beginPath();ctx.arc(x,y,25,0,Math.PI*2);ctx.fillStyle='#133b32';ctx.fill();ctx.strokeStyle=i?'#d3adff':'#9af0f0';ctx.lineWidth=5;ctx.stroke();ctx.beginPath();ctx.arc(x,y,15,clock*1.5,clock*1.5+Math.PI*1.4);ctx.lineWidth=2;ctx.stroke();});
    const [hx,hy]=hole.cup;ctx.beginPath();ctx.arc(hx,hy,17,0,Math.PI*2);ctx.fillStyle='#154534';ctx.fill();ctx.strokeStyle='#356e49';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#edf1ce';ctx.fillRect(hx+1,hy-52,3,52);ctx.beginPath();ctx.moveTo(hx+4,hy-53);ctx.lineTo(hx+39,hy-40);ctx.lineTo(hx+4,hy-27);ctx.closePath();ctx.fillStyle='#ffd377';ctx.fill();
    if(ball){
      trail.forEach((p,i)=>{ctx.fillStyle=`rgba(255,251,222,${i/trail.length*.22})`;ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();});
      if(phase==='playing'&&!ball.sunk&&!ball.vx&&!ball.vy){const length=45+power*80;ctx.save();ctx.setLineDash([4,8]);ctx.strokeStyle=drag?'#fff9d2':'#eff7cf99';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(ball.x+Math.cos(angle)*17,ball.y+Math.sin(angle)*17);ctx.lineTo(ball.x+Math.cos(angle)*length,ball.y+Math.sin(angle)*length);ctx.stroke();ctx.restore();}
      const radius=ball.sunk?Math.max(0,10*(1-sinkTime/.4)):10;
      if(radius>0){ctx.beginPath();ctx.arc(ball.x+2,ball.y+3,radius,0,Math.PI*2);ctx.fillStyle='#15372955';ctx.fill();ctx.beginPath();ctx.arc(ball.x,ball.y,radius,0,Math.PI*2);ctx.fillStyle='#fff9dd';ctx.fill();ctx.beginPath();ctx.arc(ball.x-3,ball.y-3,radius*.3,0,Math.PI*2);ctx.fillStyle='#ffffff';ctx.fill();}
    }
    ctx.textAlign='center';ctx.fillStyle='#d0dfba';ctx.font='600 11px system-ui';ctx.fillText(hole.name.toUpperCase(),300,22);
  }
  function tick(now){
    const dt=Math.min((now-last)/1000,.05);last=now;
    if(phase==='playing'){
      accumulator+=dt;
      while(accumulator>=1/120){clock+=1/120;step(ball,holes[index],1/120,clock);accumulator-=1/120;}
      if(ball.sunk){sinkTime+=dt;if(sinkTime>.4)complete();}
      else if(ball.vx||ball.vy){trail.push({x:ball.x,y:ball.y});if(trail.length>18)trail.shift();}
      else if(wasMoving){wasMoving=false;trail=[];controls();announce('Your next angle is waiting. Drag back, or adjust aim and power.');}
    }
    draw();requestAnimationFrame(tick);
  }
  $('start').addEventListener('click',()=>{if(phase==='paused')pause();else if(phase==='between'){index++;resetHole();}else startRound();});
  $('shoot').addEventListener('click',putt);$('reset').addEventListener('click',()=>{if(phase==='ready'||phase==='finished')startRound();else resetHole();});$('pause').addEventListener('click',pause);
  $('angle').addEventListener('input',e=>{angle=Number(e.target.value)*Math.PI/180;controls();});$('power').addEventListener('input',e=>{power=Number(e.target.value)/100;controls();});
  document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(e.key.toLowerCase()==='p'){pause();return;}if(phase!=='playing'||ball.sunk||ball.vx||ball.vy||e.target.tagName==='INPUT')return;if(e.code==='Space'&&e.target.tagName!=='BUTTON'&&e.target.tagName!=='A'){e.preventDefault();putt();}else if(e.key.startsWith('Arrow')){e.preventDefault();if(e.key==='ArrowLeft')angle-=Math.PI/36;if(e.key==='ArrowRight')angle+=Math.PI/36;if(e.key==='ArrowUp')power=Math.min(1,power+.05);if(e.key==='ArrowDown')power=Math.max(.1,power-.05);if(angle>Math.PI)angle-=Math.PI*2;if(angle<-Math.PI)angle+=Math.PI*2;controls();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='playing')pause();last=performance.now();accumulator=0;});
  ball={x:300,y:480,vx:0,vy:0,sunk:false};mode('ready');requestAnimationFrame(tick);
})();
