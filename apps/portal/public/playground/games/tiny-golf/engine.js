(function(root){
  const RADIUS=10, BOUNDS={left:40,top:40,right:560,bottom:560};
  const holes=[
    {name:'First light',par:2,start:[300,480],cup:[300,110],walls:[],tip:'A straight shot to settle in. Drag back to send the ball forward.'},
    {name:'Around the bend',par:3,start:[140,455],cup:[465,120],walls:[{x:278,y:210,w:28,h:350}],tip:'The wall ends near the top. Look for a way around it.'},
    {name:'Thread the needle',par:3,start:[150,460],cup:[455,110],walls:[{x:40,y:265,w:220,h:28},{x:340,y:265,w:220,h:28}],tip:'That gap in the middle is your way through.'},
    {name:'Slow and steady',par:3,start:[110,470],cup:[475,115],walls:[{x:365,y:330,w:150,h:25}],sand:[{x:160,y:190,w:235,h:205}],tip:'Sand slows you down. Take the scenic route, or put a little more into it.'},
    {name:'A little shortcut',par:2,start:[150,485],cup:[440,100],walls:[{x:40,y:280,w:520,h:28}],portals:[[150,385],[440,190]],tip:'The glowing rings are connected. Roll into one to reach the other side.'},
    {name:'The last dance',par:3,start:[300,470],cup:[300,105],walls:[{x:170,y:270,w:260,h:24,move:80}],bumpers:[[150,150,23],[450,425,23]],tip:'Time your shot around the moving gate. Finish with a flourish.'}
  ];
  function rectAt(rect,time){return {...rect,x:rect.x+(rect.move?Math.sin(time*.85)*rect.move:0)};}
  function reflect(ball,nx,ny,restitution=.82){const dot=ball.vx*nx+ball.vy*ny;if(dot<0){ball.vx-=(1+restitution)*dot*nx;ball.vy-=(1+restitution)*dot*ny;}}
  function collideRect(ball,rect){
    const nearX=Math.max(rect.x,Math.min(ball.x,rect.x+rect.w)),nearY=Math.max(rect.y,Math.min(ball.y,rect.y+rect.h));
    let dx=ball.x-nearX,dy=ball.y-nearY,dist=Math.hypot(dx,dy);
    if(dist>=RADIUS)return false;
    if(dist===0){
      const distances=[ball.x-rect.x,rect.x+rect.w-ball.x,ball.y-rect.y,rect.y+rect.h-ball.y];
      const edge=distances.indexOf(Math.min(...distances));
      if(edge===0){ball.x=rect.x-RADIUS;dx=-1;dy=0;}else if(edge===1){ball.x=rect.x+rect.w+RADIUS;dx=1;dy=0;}else if(edge===2){ball.y=rect.y-RADIUS;dx=0;dy=-1;}else{ball.y=rect.y+rect.h+RADIUS;dx=0;dy=1;}
      reflect(ball,dx,dy);return true;
    }
    const nx=dx/dist,ny=dy/dist;ball.x+=nx*(RADIUS-dist);ball.y+=ny*(RADIUS-dist);reflect(ball,nx,ny);return true;
  }
  function step(ball,hole,dt,time){
    if(ball.sunk)return;
    ball.portalCooldown=Math.max(0,(ball.portalCooldown||0)-dt);
    ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
    if(ball.x<BOUNDS.left+RADIUS){ball.x=BOUNDS.left+RADIUS;reflect(ball,1,0);}if(ball.x>BOUNDS.right-RADIUS){ball.x=BOUNDS.right-RADIUS;reflect(ball,-1,0);}
    if(ball.y<BOUNDS.top+RADIUS){ball.y=BOUNDS.top+RADIUS;reflect(ball,0,1);}if(ball.y>BOUNDS.bottom-RADIUS){ball.y=BOUNDS.bottom-RADIUS;reflect(ball,0,-1);}
    for(const rect of hole.walls)collideRect(ball,rectAt(rect,time));
    for(const [x,y,r] of hole.bumpers||[]){const dx=ball.x-x,dy=ball.y-y,d=Math.hypot(dx,dy);if(d<r+RADIUS){const nx=d?dx/d:1,ny=d?dy/d:0;ball.x=x+nx*(r+RADIUS);ball.y=y+ny*(r+RADIUS);reflect(ball,nx,ny,1.08);}}
    if(hole.portals&&ball.portalCooldown===0){
      const index=hole.portals.findIndex(([x,y])=>Math.hypot(ball.x-x,ball.y-y)<22);
      if(index>=0){const target=hole.portals[1-index],speed=Math.hypot(ball.vx,ball.vy),dx=speed?ball.vx/speed:0,dy=speed?ball.vy/speed:-1;ball.x=target[0]+dx*34;ball.y=target[1]+dy*34;ball.portalCooldown=.8;}
    }
    const onSand=(hole.sand||[]).some(r=>ball.x>=r.x&&ball.x<=r.x+r.w&&ball.y>=r.y&&ball.y<=r.y+r.h);
    const damping=Math.exp(-(onSand?4.8:1.5)*dt);ball.vx*=damping;ball.vy*=damping;
    const speed=Math.hypot(ball.vx,ball.vy),distance=Math.hypot(ball.x-hole.cup[0],ball.y-hole.cup[1]);
    if(distance<18&&speed<180){ball.x=hole.cup[0];ball.y=hole.cup[1];ball.vx=ball.vy=0;ball.sunk=true;return;}
    if(speed<7){ball.vx=ball.vy=0;}
  }
  function shoot(ball,angle,power){if(ball.sunk||Math.hypot(ball.vx,ball.vy)>0)return false;const speed=720*Math.max(.1,Math.min(1,power));ball.vx=Math.cos(angle)*speed;ball.vy=Math.sin(angle)*speed;return true;}
  const api={RADIUS,BOUNDS,holes,rectAt,collideRect,step,shoot};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GolfEngine=api;
})(globalThis);
