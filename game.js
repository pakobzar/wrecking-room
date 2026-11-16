import {THREE,buildWorld} from './world.js';
import {makeEffects,makeSound} from './effects.js';
import {makeHammer,swingDuration,swingDrive,swingContact} from './hammer.js';

const $ = id=>document.getElementById(id);
const canvas=$('scene');
const main=$('start'),title=$('intro-title'),description=$('intro-description'),restart=$('restart');
const hitCount=$('hits'),brokenCount=$('broken'),mapPlayer=$('map-player'),roomName=$('room-name');
const joystick=$('joystick'),knob=$('joystick-knob'),lookZone=$('look-zone'),strike=$('strike');
const crosshair=$('crosshair'),targetLabel=$('target-label'),toast=$('toast'),error=$('loading-error');
const touch=new URLSearchParams(location.search).get('touch')==='1' || matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints>0 && matchMedia('(hover: none)').matches);
const body=document.body;
body.classList.toggle('is-touch',touch);
main.disabled=true;

function makeEdgeFilter(renderer) {
  if (renderer.getContext().getContextAttributes()?.antialias) return null;

  const target=new THREE.WebGLRenderTarget(1,1,{
    type:renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType
  });
  const uniforms={frame:{value:target.texture},texel:{value:new THREE.Vector2(1,1)}};
  const material=new THREE.ShaderMaterial({
    uniforms,depthTest:false,depthWrite:false,
    vertexShader:`varying vec2 vUv;
      void main() { vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader:`uniform sampler2D frame;
      uniform vec2 texel;
      varying vec2 vUv;
      float luma(vec3 color) { return dot(color,vec3(.299,.587,.114)); }
      void main() {
        vec3 center=texture2D(frame,vUv).rgb;
        float nw=luma(texture2D(frame,vUv+texel*vec2(-1.,1.)).rgb);
        float ne=luma(texture2D(frame,vUv+texel).rgb);
        float sw=luma(texture2D(frame,vUv-texel).rgb);
        float se=luma(texture2D(frame,vUv+texel*vec2(1.,-1.)).rgb);
        float middle=luma(center);
        float darkest=min(middle,min(min(nw,ne),min(sw,se)));
        float lightest=max(middle,max(max(nw,ne),max(sw,se)));
        vec3 result=center;
        if(lightest-darkest>max(.012,lightest*.11)) {
          vec2 direction=vec2(sw+se-nw-ne,nw+sw-ne-se);
          float reduction=max((nw+ne+sw+se)*.03125,.0078125);
          float scale=1./(min(abs(direction.x),abs(direction.y))+reduction);
          direction=clamp(direction*scale,vec2(-7.),vec2(7.))*texel;
          vec3 soft=.5*(texture2D(frame,vUv-direction/6.).rgb+texture2D(frame,vUv+direction/6.).rgb);
          vec3 wide=.5*soft+.25*(texture2D(frame,vUv-direction*.5).rgb+texture2D(frame,vUv+direction*.5).rgb);
          float wideLuma=luma(wide);
          result=(wideLuma<darkest||wideLuma>lightest)?soft:wide;
        }
        gl_FragColor=vec4(result,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const screen=new THREE.Scene();
  const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
  quad.frustumCulled=false;
  screen.add(quad);
  const camera=new THREE.Camera();
  return {
    target,
    resize(){
      const {x,y}=renderer.getDrawingBufferSize(new THREE.Vector2());
      target.setSize(x,y);
      uniforms.texel.value.set(1/x,1/y);
    },
    present(){
      renderer.setRenderTarget(null);
      renderer.render(screen,camera);
    }
  };
}

try {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.setClearColor(0xa4b0b0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.04;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.autoClear=false;
  const edgeFilter=makeEdgeFilter(renderer);

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0xc6d7dd);
  scene.fog=new THREE.FogExp2(0xc6d7dd,.018);
  const camera=new THREE.PerspectiveCamera(60,1,.038,112);
  camera.rotation.order='YXZ';
  const sound=makeSound();
  const world=buildWorld(scene);
  const effects=makeEffects(scene,world,touch,sound.debris);
  const hammer=makeHammer();

  const sky=new THREE.HemisphereLight(0xfff4e5,0xbc9a81,1.63);
  scene.add(sky);
  const sun=new THREE.DirectionalLight(0xffe5be,2.75);
  sun.position.set(20.5,7.2,-4.5);
  sun.target.position.set(7,0,6);
  sun.castShadow=true;
  sun.shadow.mapSize.set(touch?1536:2048,touch?1536:2048);
  sun.shadow.camera.left=-12;
  sun.shadow.camera.right=12;
  sun.shadow.camera.top=9;
  sun.shadow.camera.bottom=-9;
  sun.shadow.camera.near=.7;
  sun.shadow.camera.far=40;
  sun.shadow.normalBias=.028;
  sun.shadow.bias=-.0003;
  scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight(0xbfd4ef,.29);
  fill.position.set(-5,4,-6);
  scene.add(fill);
  for (const [x,z,color,power,range] of [
    [12.35,1.58,0xffe5c4,10,5.7],[4.70,1.75,0xffe0b9,9,4.1],
    [7.85,3.91,0xffe2c6,6.5,3.75],[8.45,1.44,0xffe7d2,4.2,2.45],
    [4.19,4.20,0xffe7d2,4.1,2.3],[5.30,7.65,0xffe0b9,9,4.6],[12.30,7.45,0xffe3c7,8,4.2]
  ]) {
    const light=new THREE.PointLight(color,power,range,2);
    light.position.set(x,2.59,z);
    scene.add(light);
  }

  const keys=new Set();
  const movement=new THREE.Vector2();
  const velocity=new THREE.Vector2();
  const stick=new THREE.Vector2();
  let stickPointer=null,lookPointer=null,mouseLook='lock';
  let prevLookX=0,prevLookY=0;
  let mouseX=null,mouseY=null,edgeTurn=0;
  let playing=false,hitDone=false;
  let yaw=0,pitch=0,bob=0,stepPhase=0,foot=false,swing=-1,shake=0;
  let hits=0,broken=0,toastUntil=0,flashUntil=0,previous=performance.now(),aimTime=0;
  let targeted=null;
  let viewportDirty=true;
  const player=new THREE.Vector2();
  const eyeHeight=1.66;
  const speed=2.7;
  const turn=THREE.MathUtils.clamp;
  const layoutFov=()=>camera.aspect<.75?THREE.MathUtils.lerp(74,83,turn((.75-camera.aspect)/.35,0,1)):61;

  function resetPosition() {
    player.set(12.55,4.12);
    yaw=-.28;pitch=-.064;
    velocity.set(0,0);
    stepPhase=0;bob=0;
  }
  resetPosition();

  function resize() {
    const w=canvas.clientWidth||window.innerWidth,h=canvas.clientHeight||window.innerHeight;
    const pixels=Math.min(touch?1.5:1.7,devicePixelRatio||1);
    renderer.setPixelRatio(pixels);
    renderer.setSize(w,h,false);
    edgeFilter?.resize();
    camera.aspect=w/h;
    camera.fov=layoutFov();
    camera.updateProjectionMatrix();
    effects.resize(h*pixels);
    hammer.resize(w/h);
    viewportDirty=true;
  }
  addEventListener('resize',resize);
  window.visualViewport?.addEventListener('resize',resize);
  resize();

  function roomAt(x,z) {
    if(x<2.92&&z<4.80) return 'Balcony';
    if(x<7.1&&z<3.45) return 'Kitchen';
    if(x>=2.95&&x<5.72&&z>=3.45&&z<5.22) return 'Small bathroom';
    if(x>=7.1&&x<10.12&&z<2.70) return 'Bathroom';
    if(x>=10.12&&z<5.15) return 'Living room';
    if((x>=10.12&&z>=5.15)||(x>=9.16&&z>=6.99)) return 'Bedroom 2';
    if(z>=5.22&&x<8.10||z>=6.99) return 'Bedroom 1';
    return 'Hallway';
  }

  function setLocation() {
    const label=roomAt(player.x,player.y);
    if (roomName.textContent!==label) roomName.textContent=label;
    mapPlayer.setAttribute('transform',`translate(${player.x.toFixed(2)} ${player.y.toFixed(2)}) rotate(${(-yaw*180/Math.PI).toFixed(1)})`);
  }

  function message(label,ms=950) {
    toast.textContent=label;
    toast.classList.toggle('is-visible',Boolean(label));
    toastUntil=performance.now()+ms;
  }

  function setCrosshair() {
    const label=targeted?.entry?.active?targeted.entry.label:'';
    crosshair.classList.toggle('is-target',Boolean(label));
    if (targetLabel.textContent!==label) targetLabel.textContent=label;
    targetLabel.classList.toggle('is-visible',Boolean(label));
  }

  function setStats() {hitCount.textContent=hits;brokenCount.textContent=broken;}

  function setControlsOff() {
    keys.clear();
    velocity.set(0,0);stick.set(0,0);
    stickPointer=lookPointer=null;
    mouseX=mouseY=null;edgeTurn=0;
    knob.style.removeProperty('--stick-x');knob.style.removeProperty('--stick-y');
    joystick.classList.remove('is-active');
    targeted=null;setCrosshair();
  }

  function pause() {
    if(!playing) return;
    playing=false;
    body.classList.remove('is-playing');
    body.classList.add('is-paused');
    title.firstChild.textContent='Paused';
    description.textContent='Pick up where you left off or reset the apartment.';
    main.querySelector('span').textContent='Resume';
    setControlsOff();message('');
    if (document.pointerLockElement===canvas) document.exitPointerLock();
    main.focus({preventScroll:true});
    viewportDirty=true;
  }

  function enableFreeLook() {
    if (!playing||touch||document.pointerLockElement===canvas) return;
    mouseLook='free';
    mouseX=mouseY=null;edgeTurn=0;
  }

  function play() {
    if(playing) return;
    playing=true;
    sound.wake();
    body.classList.remove('is-paused');
    body.classList.add('is-playing');
    canvas.focus({preventScroll:true});
    if(!touch) {
      mouseLook='lock';
      try {
        if (!canvas.requestPointerLock) enableFreeLook();
        else canvas.requestPointerLock()?.catch(enableFreeLook);
      } catch {enableFreeLook();}
    }
  }

  function reset() {
    world.reset();effects.reset();resetPosition();setLocation();
    hits=broken=0;setStats();
    hitDone=false;swing=-1;shake=0;targeted=null;setCrosshair();
    renderer.shadowMap.needsUpdate=true;
    viewportDirty=true;
    play();
  }

  main.addEventListener('click',play);
  restart.addEventListener('click',reset);
  $('pause').addEventListener('click',pause);
  const soundButton=$('sound');
  soundButton.setAttribute('aria-pressed',String(sound.enabled));
  soundButton.addEventListener('click',()=>{
    sound.set(!sound.enabled);
    soundButton.setAttribute('aria-pressed',String(sound.enabled));
  });
  document.addEventListener('pointerlockchange',()=>{
    if (document.pointerLockElement===canvas) {
      mouseLook='lock';
      message('');
    } else if (mouseLook==='lock'&&playing) pause();
  });
  document.addEventListener('pointerlockerror',enableFreeLook);
  addEventListener('blur',()=>{if(!touch)pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('webglcontextlost',e=>{
    e.preventDefault();pause();main.disabled=true;
    error.hidden=false;error.textContent='Graphics stopped unexpectedly. Reload the page to continue.';
  });
  canvas.addEventListener('webglcontextrestored',()=>location.reload());

  function look(dx,dy,sensitivity) {
    yaw-=dx*sensitivity;
    pitch=turn(pitch-dy*sensitivity,-1.36,1.39);
    aimTime=0;
  }

  function startSwing() {
    if(!playing||swing>=0) return;
    swing=0;hitDone=false;
    hits++;setStats();
  }
  function impact(now) {
    const hit=world.aim(camera);
    const result=world.strike(hit);
    hitDone=true;
    if (result.destroyed.length) {
      broken+=result.destroyed.length;
      setStats();
      renderer.shadowMap.needsUpdate=true;
    }
    const entry=hit?.entry;
    sound.impact(hit?(entry?.kind??'masonry'):null,result.destroyed.length>0);
    effects.burst(hit,result.destroyed);
    if(hit) {
      shake=entry?.active ? .012 : .022;
      flashUntil=now+175;
      crosshair.classList.add('is-impact');
      if(touch) navigator.vibrate?.(result.destroyed.length?32:16);
    } else if(hits===1) message('Move closer to a wall or object');
    aimTime=0;
  }

  const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','ShiftLeft','ShiftRight']);
  addEventListener('keydown',event=>{
    if(!playing) return;
    if(event.code==='Escape') {event.preventDefault();pause();return;}
    if(event.code==='Space'&&event.target.tagName!=='BUTTON') {event.preventDefault();if(!event.repeat)startSwing();return;}
    if(movementKeys.has(event.code)) {event.preventDefault();keys.add(event.code);}
  });
  addEventListener('keyup',event=>keys.delete(event.code));
  document.addEventListener('mousemove',event=>{
    if (playing&&document.pointerLockElement===canvas) look(event.movementX,event.movementY,.00215);
  });
  document.addEventListener('mousedown',event=>{
    const canSwing=document.pointerLockElement===canvas||(mouseLook==='free'&&event.target===canvas);
    if (playing&&!touch&&canSwing&&event.button===0) {
      event.preventDefault();startSwing();
    }
  });

  canvas.addEventListener('mousemove',event=>{
    if(!playing||touch||mouseLook!=='free'||document.pointerLockElement===canvas) return;
    if(mouseX!==null) look(event.clientX-mouseX,event.clientY-mouseY,.0047);
    mouseX=event.clientX;mouseY=event.clientY;
    const rect=canvas.getBoundingClientRect();
    const left=mouseX-rect.left,right=rect.right-mouseX;
    edgeTurn=(Math.max(0,20-right)-Math.max(0,20-left))/20;
  });
  canvas.addEventListener('mouseleave',()=>{
    mouseX=mouseY=null;edgeTurn=0;
  });

  function joystickMove(event) {
    const rect=joystick.getBoundingClientRect(),radius=rect.width*.315;
    stick.set((event.clientX-rect.left-rect.width*.5)/radius,(event.clientY-rect.top-rect.height*.5)/radius);
    if(stick.lengthSq()>1) stick.normalize();
    knob.style.setProperty('--stick-x',`${stick.x*radius}px`);
    knob.style.setProperty('--stick-y',`${stick.y*radius}px`);
  }
  joystick.addEventListener('pointerdown',event=>{
    if(!playing||stickPointer!==null)return;
    event.preventDefault();stickPointer=event.pointerId;joystick.setPointerCapture(stickPointer);
    joystick.classList.add('is-active');joystickMove(event);
  });
  joystick.addEventListener('pointermove',event=>{
    if(event.pointerId===stickPointer) joystickMove(event);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) joystick.addEventListener(type,event=>{
    if(event.pointerId!==stickPointer)return;
    stickPointer=null;stick.set(0,0);
    knob.style.removeProperty('--stick-x');knob.style.removeProperty('--stick-y');
    joystick.classList.remove('is-active');
  });
  lookZone.addEventListener('pointerdown',event=>{
    if(!playing||lookPointer!==null) return;
    event.preventDefault();lookPointer=event.pointerId;lookZone.setPointerCapture(lookPointer);
    prevLookX=event.clientX;prevLookY=event.clientY;
  });
  lookZone.addEventListener('pointermove',event=>{
    if(event.pointerId!==lookPointer) return;
    look(event.clientX-prevLookX,event.clientY-prevLookY,.0056);
    prevLookX=event.clientX;prevLookY=event.clientY;
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) lookZone.addEventListener(type,event=>{
    if(event.pointerId===lookPointer) lookPointer=null;
  });
  strike.addEventListener('pointerdown',event=>{event.preventDefault();startSwing();});
  strike.addEventListener('click',startSwing);

  function render(now) {
    requestAnimationFrame(render);
    const t=now*.001,dt=Math.min(.04,(now-previous)*.001);
    previous=now;
    if(!playing&&!viewportDirty) return;
    viewportDirty=false;
    if(playing) {
      if(mouseLook==='free'&&edgeTurn) look(edgeTurn,0,dt*.83);
      movement.set(
        Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))+stick.x,
        Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))+stick.y);
      if(movement.lengthSq()>1) movement.normalize();
      const running=keys.has('ShiftLeft')||keys.has('ShiftRight');
      velocity.lerp(movement.multiplyScalar(running?4.1:speed),1-Math.exp(-16*dt));
      const sin=Math.sin(yaw),cos=Math.cos(yaw);
      const dx=(velocity.x*cos+velocity.y*sin)*dt,dz=(-velocity.x*sin+velocity.y*cos)*dt;
      let moved=0;
      if(!world.blocked(player.x+dx,player.y)) {player.x+=dx;moved+=dx*dx;}
      if(!world.blocked(player.x,player.y+dz)) {player.y+=dz;moved+=dz*dz;}
      const last=stepPhase;
      stepPhase+=Math.sqrt(moved)*(running?6.75:7.68);
      if(Math.floor(stepPhase/Math.PI)!==Math.floor(last/Math.PI)) {foot=!foot;sound.step(foot);}
      bob=THREE.MathUtils.lerp(bob,Math.sin(stepPhase)*Math.min(1,Math.sqrt(moved)/Math.max(.001,dt*speed))*.036,1-Math.exp(-12*dt));
      shake*=Math.exp(-dt*22);
      if(swing>=0) {
        const previousSwing=swing;
        swing+=dt/swingDuration;
        if(previousSwing<swingDrive&&swing>=swingDrive) sound.swing();
        if(swing>=1) swing=-1;
      }
      if (now>toastUntil&&toast.textContent) message('');
      if (flashUntil&&now>flashUntil) {crosshair.classList.remove('is-impact');flashUntil=0;}
      for(const landing of world.update(dt)) {
        if(landing.destroyed.length) {
          broken+=landing.destroyed.length;
          setStats();
          effects.burst(landing.hit,landing.destroyed);
          sound.impact(landing.hit.entry.kind,true);
          renderer.shadowMap.needsUpdate=true;
        } else sound.debris(landing.hit.entry.kind,landing.energy);
      }
      effects.update(dt);setLocation();
    }
    camera.position.set(player.x,eyeHeight+bob,player.y);
    camera.rotation.set(pitch+Math.sin(t*73)*shake,yaw+Math.sin(t*101)*shake*.39,bob*.12);
    camera.updateMatrixWorld();
    if (playing&&swing>=swingContact&&!hitDone) impact(now);
    if (playing&&now>=aimTime) {targeted=world.aim(camera);setCrosshair();aimTime=now+75;}
    hammer.update(t,bob,swing);
    if(edgeFilter) renderer.setRenderTarget(edgeFilter.target);
    renderer.clear();
    renderer.render(scene,camera);
    renderer.clearDepth();
    renderer.render(hammer.scene,hammer.camera);
    edgeFilter?.present();
  }
  renderer.shadowMap.needsUpdate=true;
  setLocation();setStats();requestAnimationFrame(render);
  body.classList.remove('is-loading');
  main.disabled=false;
} catch (cause) {
  console.error(cause);
  body.classList.remove('is-loading');
  error.textContent='The 3D scene could not load. Enable WebGL 2 in your browser and reload the page.';
  error.hidden=false;
}
