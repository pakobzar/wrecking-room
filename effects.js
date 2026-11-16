import {THREE,randomGenerator} from './world.js';

const clamp = THREE.MathUtils.clamp;
const bodyMatrix = new THREE.Matrix4();
const bounds = new THREE.Box3();
const pivot = new THREE.Vector3();
const size = new THREE.Vector3();
const flat = new THREE.CylinderGeometry(.61,.43,1,3,1);
const sliver = new THREE.TetrahedronGeometry(.66);
const block = new THREE.DodecahedronGeometry(.62);
const woodOutline = new THREE.Shape();
woodOutline.moveTo(-.53,-.36);
woodOutline.lineTo(-.31,-.49);
woodOutline.lineTo(.46,-.45);
woodOutline.lineTo(.36,-.16);
woodOutline.lineTo(.57,.02);
woodOutline.lineTo(.28,.43);
woodOutline.lineTo(-.49,.41);
woodOutline.closePath();
const lumber = new THREE.ExtrudeGeometry(woodOutline,{depth:.76,bevelEnabled:false});
lumber.translate(0,0,-.38);
const schemes = {
  plaster:{material:'plaster',secondary:'plasterCore',life:1.0},
  wood:{material:'woodEnd',secondary:'oak',life:.72},
  ceramic:{material:'porcelain',secondary:'paleTile',life:.67},
  tile:{material:'paleTile',secondary:'plasterCore',life:.83},
  fabric:{material:'linen',secondary:'woodEnd',life:.73},
  glass:{material:'glassEdge',secondary:'glassEdge',life:.42},
  metal:{material:'metalEdge',secondary:'steel',life:.37},
  masonry:{material:'masonry',secondary:'concrete',life:1.15}
};

export function makeEffects(scene,world,isTouch,clatter) {
  const bins = new Map();
  const random = randomGenerator(47832);
  const velocity = new THREE.Vector3();
  const propPosition = new THREE.Vector3();
  const partPosition = new THREE.Vector3();
  const partScale = new THREE.Vector3();
  const dustCount=isTouch?140:250;
  const dustPositions=new Float32Array(dustCount*3);
  const dustAlpha=new Float32Array(dustCount);
  const dustSize=new Float32Array(dustCount);
  const dust=[];
  let dustCursor=0;
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3).setUsage(THREE.DynamicDrawUsage));
  dustGeometry.setAttribute('alpha',new THREE.BufferAttribute(dustAlpha,1).setUsage(THREE.DynamicDrawUsage));
  dustGeometry.setAttribute('diameter',new THREE.BufferAttribute(dustSize,1).setUsage(THREE.DynamicDrawUsage));
  const dustMat = new THREE.ShaderMaterial({
    uniforms:{pixelScale:{value:190}},
    vertexShader:`attribute float alpha; attribute float diameter; uniform float pixelScale; varying float a;
      void main(){a=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;
      gl_PointSize=clamp(diameter*pixelScale/max(.23,-p.z),1.,150.);}`,
    fragmentShader:`varying float a;void main(){float r=length(gl_PointCoord-.5);float haze=pow(max(0.,1.-r*2.),1.85);
      gl_FragColor=vec4(.83,.72,.60,a*haze);}`,
    transparent:true,depthWrite:false
  });
  const points = new THREE.Points(dustGeometry,dustMat);
  points.frustumCulled=false;
  points.renderOrder=2;
  scene.add(points);

  function shard(geometry,mat,p,s,normal,power,kind) {
    const key=`${geometry.id}/${mat.id}`;
    let bin=bins.get(key);
    if (!bin) {
      const capacity=isTouch?23:42;
      const mesh=new THREE.InstancedMesh(geometry,mat,capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled=false;
      mesh.receiveShadow=true;
      mesh.count=0;
      scene.add(mesh);
      bin={mesh,capacity,next:0,bodies:[]};
      bins.set(key,bin);
    }
    const i=bin.next++ % bin.capacity;
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(random()*6,random()*6,random()*6));
    velocity.set((random()-.5)*3,random()*2.8+.45,(random()-.5)*3).addScaledVector(normal,power);
    const body={p:p.clone(),v:velocity.clone(),q,s:s.clone(),angle:new THREE.Vector3(random()-.5,random()-.5,random()-.5).normalize(),spin:3+random()*10,sleep:false,age:0,kind};
    body.radius=Math.min(s.x,s.y,s.z)*.36+.012;
    body.floor=Math.max(s.x,s.y,s.z)*.23+.016;
    bin.bodies[i]=body;
    bin.mesh.count=Math.max(bin.mesh.count,i+1);
    bin.mesh.setColorAt(i,new THREE.Color().setScalar(.69+random()*.3));
    bin.mesh.instanceColor.needsUpdate=true;
    bin.mesh.setMatrixAt(i,bodyMatrix.compose(body.p,body.q,body.s));
    bin.mesh.instanceMatrix.needsUpdate=true;
  }

  function cloud(p,normal,kind,count,power) {
    const scheme=schemes[kind]??schemes.plaster;
    for (let n=0;n<count;n++) {
      const index=dustCursor++ % dustCount;
      const ttl=(.3+random()*.7)*scheme.life;
      const at=p.clone().add(new THREE.Vector3((random()-.5)*.3,(random()-.5)*.3,(random()-.5)*.3));
      const v=new THREE.Vector3((random()-.5)*.72,random()*.76+.18,(random()-.5)*.72).addScaledVector(normal,power);
      dust[index]={at,v,ttl,age:0,size:(random()*.24+.07),opacity:.12+random()*.24};
    }
  }

  function burst(hit,parts) {
    if (!hit) return;
    cloud(hit.point,hit.normal,hit.entry?.kind??'plaster',parts.length?(isTouch?30:46):12,.7);
    if (!parts.length) return;
    for (const part of parts) {
      const kind=part.kind;
      const scheme=schemes[kind]??schemes.plaster;
      if (part.type==='wall') {
        for (let i=0;i<(isTouch?6:9);i++) {
          partPosition.set((random()-.5)*part.scale.x,(random()-.5)*part.scale.y,(random()-.5)*part.scale.z);
          partPosition.applyQuaternion(part.span.quaternion).add(part.position).addScaledVector(hit.normal,.12);
          const s=(i<3?.14:.048)+random()*(i<3?.23:.09);
          partScale.set(s*(.74+random()*.8),s*(.53+random()*.69),s*(.46+random()*.44));
          shard(i%3===0 ? flat : block, i%3===0 ? part.mat : world.material(scheme.secondary),partPosition,partScale,hit.normal,.12+random()*1.25,kind);
        }
        continue;
      }
      const meshes=part.meshes.filter(mesh=>mesh.geometry&&(!mesh.material?.transparent || kind==='glass'));
      const tries=isTouch?22:34;
      for (let i=0;i<tries;i++) {
        const source=meshes[Math.floor(random()*meshes.length)];
        if (!source) break;
        if (!source.geometry.boundingBox) source.geometry.computeBoundingBox();
        bounds.copy(source.geometry.boundingBox).applyMatrix4(source.matrixWorld);
        bounds.getCenter(pivot);
        bounds.getSize(size);
        propPosition.set((random()-.5)*size.x*.88,(random()-.5)*size.y*.88,(random()-.5)*size.z*.88).add(pivot);
        propPosition.addScaledVector(hit.normal,.08);
        const s=(i<5?.15:.055)+random()*(i<5?.24:.09);
        const isWood=kind==='wood'||(kind==='fabric'&&i%5===0);
        const isGlass=kind==='glass';
        const isMetal=kind==='metal';
        const shape=isWood?lumber:isGlass?sliver:isMetal?flat:block;
        const original=source.material;
        const mat=(isGlass || Array.isArray(original) || !original?.isMeshStandardMaterial || i%4===0)
          ?world.material(i%3===0?scheme.secondary:scheme.material):original;
        const long=1+random()*(isWood?1.62:.64);
        partScale.set(s*long,s*(isGlass?.12:.45+random()*.48),s*(.36+random()*.58));
        shard(shape,mat,propPosition,partScale,hit.normal,.32+random()*1.51,kind);
      }
    }
  }

  const rotation=new THREE.Quaternion();
  function update(dt) {
    for (const bin of bins.values()) {
      let dirty=false;
      for (let i=0;i<bin.mesh.count;i++) {
        const b=bin.bodies[i];
        if (!b || b.sleep) continue;
        b.age+=dt;
        const {p,v}=b;
        const oldX=p.x,oldY=p.y,oldZ=p.z;
        v.y-=9.8*dt;
        p.addScaledVector(v,dt);
        if (p.y<b.floor) {
          if(v.y<-2.2) clatter?.(b.kind,Math.abs(v.y)*b.floor);
          p.y=b.floor;
          v.y=v.y<-.95 ? -v.y*.25:0;
          v.x*=.67; v.z*=.67; b.spin*=.72;
        }
        if (p.y>2.79 && oldY<=2.79 && v.y>0) {p.y=2.79;v.y*=-.2;}
        const obstacle=world.debrisCollision(p.x,p.y,p.z,b.radius);
        if (obstacle) {
          if (oldY>=obstacle.max.y) {p.y=obstacle.max.y+b.radius;v.y=Math.abs(v.y)*.23;v.x*=.64;v.z*=.64;b.spin*=.78;}
          else if (oldY<=obstacle.min.y) {p.y=obstacle.min.y-b.radius;v.y=-Math.abs(v.y)*.24;}
          else if (oldX<=obstacle.min.x || oldX>=obstacle.max.x) {p.x=oldX;v.x*=-.36;}
          else if (oldZ<=obstacle.min.z || oldZ>=obstacle.max.z) {p.z=oldZ;v.z*=-.36;}
        }
        if (p.x<.08 || p.x>14.70) {p.x=clamp(p.x,.08,14.70);v.x*=-.30;}
        if (p.z<.08 || p.z>9.22) {p.z=clamp(p.z,.08,9.22);v.z*=-.30;}
        rotation.setFromAxisAngle(b.angle,b.spin*dt);
        b.q.multiply(rotation);
        if ((b.age>.6 && (p.y<=b.floor+.01 || obstacle) && v.lengthSq()<.025) || b.age>5) b.sleep=true;
        bin.mesh.setMatrixAt(i,bodyMatrix.compose(p,b.q,b.s));
        dirty=true;
      }
      if (dirty) bin.mesh.instanceMatrix.needsUpdate=true;
    }
    if (!dust.length) return;
    for(let i=0;i<dust.length;i++) {
      const d=dust[i];
      if (!d) continue;
      d.age+=dt;
      if(d.age>d.ttl) {dust[i]=null;dustAlpha[i]=0;continue;}
      d.v.multiplyScalar(1-dt*.62);
      d.at.addScaledVector(d.v,dt);
      d.at.toArray(dustPositions,i*3);
      const phase=d.age/d.ttl;
      dustAlpha[i]=d.opacity*Math.min(1,phase*9)*(1-phase);
      dustSize[i]=d.size*(1+phase*2.7);
    }
    for(const attribute of Object.values(dustGeometry.attributes)) attribute.needsUpdate=true;
  }

  function reset() {
    for(const {mesh,bodies} of bins.values()) {mesh.count=0;bodies.length=0;}
    for(const bin of bins.values()) bin.next=0;
    dust.length=0;
    dustAlpha.fill(0);
    dustGeometry.attributes.alpha.needsUpdate=true;
  }

  function resize(height) {dustMat.uniforms.pixelScale.value=height*.8;}
  return {burst,update,reset,resize};
}

export function makeSound() {
  let context=null,volume=null,noise=null;
  let lastDebris=-1;
  let enabled=true;
  try {enabled=localStorage.getItem('razlom-sound')!=='off';} catch {}
  function wake() {
    if (!enabled) return;
    const Audio=window.AudioContext??window.webkitAudioContext;
    if(!Audio) return;
    if(!context) {
      context=new Audio();
      volume=context.createGain();volume.gain.value=.66;volume.connect(context.destination);
      noise=context.createBuffer(1,context.sampleRate,context.sampleRate);
      const samples=noise.getChannelData(0);
      for(let i=0;i<samples.length;i++) samples[i]=Math.random()*2-1;
    }
    if(context.state==='suspended') context.resume().catch(()=>{});
  }
  function set(value) {
    enabled=value;
    try{localStorage.setItem('razlom-sound',value?'on':'off');}catch{}
    if(value) wake();
    if (volume) volume.gain.value=value ? .66 : 0;
  }
  function rustle(seconds,frequency,level,type='lowpass',delay=0) {
    const t=context.currentTime+delay;
    const sample=context.createBufferSource();sample.buffer=noise;
    const filter=context.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=.74;
    const fade=context.createGain();fade.gain.setValueAtTime(.0001,t);
    fade.gain.exponentialRampToValueAtTime(level,t+.012);
    fade.gain.exponentialRampToValueAtTime(.0001,t+seconds);
    sample.connect(filter).connect(fade).connect(volume);
    sample.start(t,Math.random()*.22);sample.stop(t+seconds+.03);
  }
  function tone(hz,end,seconds,gain,type='sine',delay=0) {
    const t=context.currentTime+delay;
    const wave=context.createOscillator();wave.type=type;wave.frequency.setValueAtTime(hz,t);wave.frequency.exponentialRampToValueAtTime(end,t+seconds);
    const fade=context.createGain();fade.gain.setValueAtTime(gain,t);fade.gain.exponentialRampToValueAtTime(.0001,t+seconds);
    wave.connect(fade).connect(volume);wave.start(t);wave.stop(t+seconds+.01);
  }
  function impact(kind,shattered) {
    if(!enabled||!context) return;
    if(!kind) {rustle(.10,510,.056,'bandpass');return;}
    const hard=kind==='ceramic'||kind==='tile'||kind==='glass'||kind==='metal';
    tone(hard?175:74,hard?70:24,.20,hard?.14:.39,'triangle');
    rustle(shattered?.28:.15,hard?5500:kind==='wood'?1420:800,shattered?.53:.32,hard?'highpass':'lowpass');
    if(hard) for(let i=0;i<5;i++) tone(1400+i*473,1100+i*383,.19,.042,'sine',i*.012);
    if(shattered) rustle(.19,kind==='wood'?2350:4400,.13,'bandpass',.046);
  }
  function swing() {
    if(!enabled||!context) return;
    rustle(.17,523,.15,'bandpass');
    rustle(.10,1140,.10,'bandpass',.048);
  }
  function debris(kind,energy) {
    if(!enabled||!context||context.currentTime-lastDebris<.064) return;
    lastDebris=context.currentTime;
    const hard=kind==='glass'||kind==='ceramic'||kind==='metal'||kind==='tile';
    rustle(.078,hard?4300:kind==='wood'?1120:720,Math.min(.13,.039+energy*.042),hard?'highpass':'bandpass');
    if(hard) tone(1700+Math.random()*900,1070,.096,.017);
  }
  function step(foot) {
    if(!enabled||!context) return;
    rustle(.11,foot?300:240,.135,'lowpass');
    rustle(.063,1280+Math.random()*760,.045,'bandpass',.014);
  }
  return {wake,set,swing,impact,debris,step,get enabled(){return enabled;}};
}
