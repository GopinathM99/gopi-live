(() => {
  const $ = id => document.getElementById(id), canvas = $('canvas'), ctx = canvas.getContext('2d');
  const W = 600, H = 660, blockH = 24, baseY = 550;
  let phase = 'ready', tower = [], moving, debris = [], sparkles = [], camera = 0, score = 0, streak = 0, best = 0, elapsed = 0, last = performance.now(), flash = '';
  let flashTime = 0, fallTime = 0;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  try { best = Math.max(0, Number(localStorage.getItem('gopi-playground-stack-best')) || 0); } catch {}
  $('best').textContent = best;
  function mode(value) { phase = value; document.body.dataset.state = value; $('drop').disabled = value !== 'playing'; $('pause').disabled = value === 'ready' || value === 'over'; }
  function announce(text) { $('status').textContent = text; }
  function color(i) { return `hsl(${245 + (i * 9) % 150} 72% ${62 + i % 3 * 3}%)`; }
  function spawn() { const top = tower.at(-1); moving = {x: score % 2 ? W - 10 : 10 - top.width, y: top.y - blockH, width: top.width, vx: (score % 2 ? -1 : 1) * Math.min(350, 235 + score * 6), hue: color(score + 1)}; }
  function reset() {
    tower = [{ x: 180, y: baseY, width: 240, hue: '#7663b2' }]; score = streak = camera = elapsed = 0; debris = []; sparkles = []; flashTime = 0;
    $('score').textContent = '0'; $('streak').textContent = '0'; $('overlay').hidden = true; mode('playing'); spawn(); last = performance.now(); announce('Wait for the overlap. Then drop.');
  }
  function showOverlay(title, copy, label, kicker) {
    $('overlay-title').textContent = title; $('overlay-copy').textContent = copy; $('start').textContent = label; $('overlay-kicker').textContent = kicker; $('overlay').hidden = false;
  }
  function pause() {
    if (phase === 'playing') { mode('paused'); showOverlay('Hold that thought.', 'Your tower can wait. Take a breath.', 'Keep stacking →', 'ON PAUSE'); announce('Game paused.'); }
    else if (phase === 'paused') { mode('playing'); $('overlay').hidden = true; last = performance.now(); announce('Back in the flow.'); }
  }
  function drop() {
    if (phase !== 'playing') return;
    const result = StackEngine.landing(tower.at(-1), moving);
    if (!result) {
      debris.push({...moving, vy:50, spin:.7, rotation:0}); moving = null; mode('over'); fallTime = .6;
      announce(`Tower finished at ${score} floors. Your best is ${best}.`); return;
    }
    score++;
    if (result.perfect) {
      streak++; flash = streak >= 3 ? `PERFECT ×${streak}` : 'PERFECT'; flashTime = 1;
      if (streak >= 3) { const growth = Math.min(8, 240 - result.width); result.x -= growth / 2; result.width += growth; }
      if (!reduceMotion) for (let i=0;i<16;i++) sparkles.push({x:result.x+Math.random()*result.width,y:moving.y,vx:(Math.random()-.5)*100,vy:-Math.random()*100,life:1,hue:moving.hue});
      announce(streak >= 3 ? `Perfect streak of ${streak}! Your tower gets a little wider.` : 'Perfect placement. Keep that rhythm.');
    } else {
      streak = 0; flashTime = 0;
      if (result.cut.width > 0) debris.push({...result.cut, y:moving.y, hue:moving.hue, vy:25, spin:Math.sign(moving.vx)*1.5, rotation:0});
      announce(result.width < 50 ? 'A tiny target. You’ve got this.' : 'Still standing. One more floor.');
    }
    tower.push({x:result.x,y:moving.y,width:result.width,hue:moving.hue});
    if (score > best) { best = score; try {localStorage.setItem('gopi-playground-stack-best', String(best));} catch {} }
    $('score').textContent = score; $('best').textContent = best; $('streak').textContent = streak;
    spawn();
  }
  function block(x,y,width,hue,alpha=1,rotation=0) {
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(x+width/2,y+blockH/2);ctx.rotate(rotation);
    const g=ctx.createLinearGradient(0,-blockH/2,0,blockH/2);g.addColorStop(0,hue);g.addColorStop(1,hue);
    ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(-width/2,-blockH/2,Math.max(1,width),blockH-2,Math.min(4,width/2));ctx.fill();
    ctx.fillStyle='#ffffff24';ctx.fillRect(-width/2+2,-blockH/2+2,Math.max(0,width-4),4);ctx.restore();
  }
  function draw() {
    const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#19152b');bg.addColorStop(1,'#252039');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#ba9ded0c';ctx.lineWidth=1;for(let x=0;x<W;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=(camera*.25)%60;y<H;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    for(let i=0;i<30;i++){ctx.fillStyle=`rgba(213,193,246,${.12+(i%4)*.06})`;ctx.beginPath();ctx.arc((i*173+37)%W,(i*113+camera*.1)%H,i%3===0?1.5:1,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#c3a2ff09';ctx.beginPath();ctx.ellipse(300,baseY+blockH+camera,180,16,0,0,Math.PI*2);ctx.fill();
    const top=tower.at(-1);
    if(top&&phase==='playing'){ctx.setLineDash([4,8]);ctx.strokeStyle='#dac5ff33';ctx.strokeRect(top.x,top.y-blockH+camera,top.width,blockH-2);ctx.setLineDash([]);}
    tower.forEach(b=>{const y=b.y+camera;if(y>-blockH&&y<H)block(b.x,y,b.width,b.hue);});
    if(moving)block(moving.x,moving.y+camera,moving.width,moving.hue);
    debris.forEach(b=>block(b.x,b.y+camera,b.width,b.hue,.8,b.rotation));
    sparkles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.hue;ctx.fillRect(p.x,p.y+camera,4,4);});ctx.globalAlpha=1;
    if(flashTime>0&&top){ctx.save();ctx.globalAlpha=Math.min(1,flashTime*2);ctx.textAlign='center';ctx.fillStyle='#e5cdff';ctx.font='700 23px system-ui';ctx.fillText(flash,300,top.y+camera-66);ctx.restore();}
    ctx.textAlign='center';ctx.font='11px system-ui';ctx.fillStyle='#c1acc56b';ctx.fillText('ONE BLOCK AT A TIME',300,H-28);
  }
  function tick(now) {
    const dt=Math.min((now-last)/1000,.05);last=now;
    if(phase==='playing'){
      elapsed+=dt;moving.x+=moving.vx*dt;
      if(moving.x>W-8){moving.x=W-8;moving.vx=-Math.abs(moving.vx);}if(moving.x+moving.width<8){moving.x=8-moving.width;moving.vx=Math.abs(moving.vx);}
      camera+=(Math.max(0,(score-7)*blockH)-camera)*Math.min(1,dt*6);flashTime=Math.max(0,flashTime-dt);
    }
    if(phase==='playing'||phase==='over'){
      debris.forEach(b=>{b.vy+=650*dt;b.y+=b.vy*dt;b.rotation+=b.spin*dt;});debris=debris.filter(b=>b.y+camera<H+100);
      sparkles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=120*dt;p.life-=dt;});sparkles=sparkles.filter(p=>p.life>0);
      if(phase==='over'&&fallTime>0){fallTime-=dt;if(fallTime<=0)showOverlay(score>=best&&score>0?'A new high. Literally.':'One more go?',`${score} floors. ${score>15?'That was a beautiful run.':'The next one could be your best.'}`,'Build another tower →','YOUR BEST: '+best+' FLOORS');}
    }
    draw();requestAnimationFrame(tick);
  }
  $('start').addEventListener('click',()=>phase==='paused'?pause():reset());$('drop').addEventListener('click',drop);$('restart').addEventListener('click',reset);$('pause').addEventListener('click',pause);
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();drop();});
  document.addEventListener('keydown',e=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='Space'&&e.target.tagName!=='BUTTON'&&e.target.tagName!=='A'){e.preventDefault();if(phase==='playing')drop();else if(phase==='ready'||phase==='over'&&fallTime<=0)reset();}if(e.key.toLowerCase()==='p')pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='playing')pause();last=performance.now();});
  tower=[{x:180,y:baseY,width:240,hue:'#7663b2'}];moving={x:220,y:baseY-blockH,width:240,hue:color(1)};mode('ready');requestAnimationFrame(tick);
})();
