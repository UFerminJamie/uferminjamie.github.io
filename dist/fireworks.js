const canvas = document.getElementById('fireworks');
const ctx = canvas.getContext('2d');
const originalBodyBg = document.body.style.backgroundColor || '';
let w = 0, h = 0, lastTime = 0;

function resize(){
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function rand(min,max){ return Math.random()*(max-min)+min }

class Particle{
  constructor(x,y, vx, vy, color, life){
    this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.color=color; this.life=life; this.age=0; this.size=rand(1,3);
  }
  update(dt){
    this.vy += 40 * dt; // gravity
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.age += dt;
  }
  draw(){
    const t = 1 - Math.min(this.age/this.life, 1);
    ctx.globalAlpha = t;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * t, 0, Math.PI*2);
    ctx.fill();
  }
}

class Rocket{
  constructor(){
    this.x = rand(w*0.15, w*0.85);
    this.y = h + 10;
    this.vx = rand(-40,40);
    // give each rocket a depth factor: <1 = near, ~1 = mid, >1 = far
    this.depth = rand(0.6, 1.6);
    // adjust upward speed by depth so rockets explode at mixed heights
    this.vy = rand(-700, -900) / this.depth;
    this.color = `hsl(${Math.floor(rand(0,360))}, 90%, 60%)`;
    this.exploded = false;
  }
  update(dt){
    this.vy += 400 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if(this.vy > -80 && !this.exploded){
      this.exploded = true;
      explode(this.x, this.y, this.color, this.depth);
      return false;
    }
    return true;
  }
  draw(){
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2.5, 0, Math.PI*4);
    ctx.fill();
  }
}

const rockets = [];
const particles = [];

function explode(x,y,color, baseDepth=1){
  // make bigger, more colorful explosions; distribute particles across depths
  const count = Math.floor(rand(60, 160));
  for(let i=0;i<count;i++){
    const ang = Math.random()*Math.PI*2;
    // give each particle a depth around the rocket's baseDepth
    const depth = Math.min(2, Math.max(0.4, baseDepth * rand(0.75, 1.35)));
    // farther particles move slower and appear smaller
    const sp = rand(120, 640) / depth;
    const p = new Particle(x, y, Math.cos(ang)*sp, Math.sin(ang)*sp, color, rand(0.9, 2.4));
    p.size = (rand(2, 6) / depth);
    p.depth = depth;
    // dim color a bit for distant particles
    if(depth > 1.15){
      p.color = color.replace('%', '%').replace('90%', '70%');
    }
    particles.push(p);
  }
  // dispatch an event so the 3D scene can react (lighting on cake/table)
  try{
    const intensity = Math.min(3.0, count / 80);
    document.dispatchEvent(new CustomEvent('firework-explosion', { detail: { x, y, color, intensity, count, depth: baseDepth } }));
  }catch(e){ }
}

let launchTimer = 0;

function update(dt){
  if(running){
    launchTimer -= dt;
    if(launchTimer <= 0){
      launchTimer = rand(0.35, 1.0);
      rockets.push(new Rocket());
    }
  }

  for(let i = rockets.length-1; i>=0; i--){
    const r = rockets[i];
    const alive = r.update(dt);
    if(!alive) rockets.splice(i,1);
  }

  for(let i = particles.length-1; i>=0; i--){
    const p = particles[i];
    p.update(dt);
    if(p.age >= p.life) particles.splice(i,1);
  }
}

function draw(){
  // translucent black for trails
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0,0,w,h);
  ctx.globalCompositeOperation = 'lighter';

  rockets.forEach(r=>r.draw());
  particles.forEach(p=>p.draw());

  ctx.globalCompositeOperation = 'source-over';
}

let running = true;
function loop(ts){
  if(!lastTime) lastTime = ts;
  const dt = Math.min((ts-lastTime)/1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// start with a few rockets
for(let i=0;i<3;i++) rockets.push(new Rocket());

// make sure canvas covers high-dpi screens
function fixDPR(){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', ()=>{ resize(); fixDPR(); });
fixDPR();

// switch body background to solid black when many fireworks are active
function updateBackground() {
  const total = rockets.length + particles.length;
  const threshold = 30; // when above this, force a black background
  if (total >= threshold) {
    document.body.style.backgroundColor = '#000';
  } else {
    document.body.style.backgroundColor = originalBodyBg;
  }
}

// call background update each frame and start the loop
function wrappedLoop(ts){
  updateBackground();
  loop(ts);
}
// start animation
requestAnimationFrame(wrappedLoop);

// control functions exposed to other scripts
window.stopFireworks = function(){
  running = false;
  // clear existing particles and rockets
  rockets.length = 0;
  particles.length = 0;
  // fade out canvas then hide
  canvas.style.transition = 'opacity 800ms ease';
  canvas.style.opacity = '0';
  setTimeout(()=>{
    ctx.clearRect(0,0,w,h);
    canvas.style.display = 'none';
    // ensure page background is solid black when fireworks stop
    document.body.style.backgroundColor = '#000';
  }, 900);
};

window.startFireworks = function(){
  running = true;
  canvas.style.display = '';
  canvas.style.transition = '';
  canvas.style.opacity = '1';
};
