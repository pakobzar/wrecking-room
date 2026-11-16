import * as THREE from './three.module.js';
import {buildArchitecture} from './architecture.js';
import {buildFurnishings} from './furnishings.js';

export {THREE};

export function randomGenerator(seed) {
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function surfaceTexture(type, base) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const data = ctx.createImageData(256, 256);
  const random = randomGenerator(type === 'wood' ? 69 : 342);
  const [r,g,b] = [base >> 16, base >> 8 & 255, base & 255];
  const strips = Array.from({length:256}, () => (random() - .5) * 12);
  for (let y=0; y<256; y++) for(let x=0; x<256; x++) {
    let n = (random()-.5)*7;
    if (type === 'wood') {
      const row = Math.round(y + 2.7*Math.sin(x*.018+y*.048) + .7*Math.sin(x*.066+y*.15)) & 255;
      n += Math.sin(y*.24 + Math.sin(x*.027 + y*.015)*.6)*3.5 + strips[row];
    }
    if (type === 'fabric') n += ((x%3===0?1:0)-(y%3===0?1:0))*10;
    if (type === 'stone') n += 3*Math.sin(x*.045+y*.1)+1.8*Math.sin(x*.44-y*.37);
    const i = (y*256+x)*4;
    data.data.set([r+n,g+n,b+n,255], i);
  }
  ctx.putImageData(data,0,0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function makeMaterials() {
  const options = {
    plaster: [0xd8cfc0,.91,0,'stone'], ceiling:[0xeae0ce,.95,0,'stone'],
    oak:[0xa27651,.67,0,'wood'], walnut:[0x674233,.64,0,'wood'], trim:[0xd4c3ad,.78,0],
    concrete:[0xa7a096,.95,0,'stone'], masonry:[0x947c6b,.91,0,'stone'],
    brass:[0xa47949,.34,.65], steel:[0x767c7b,.35,.68], porcelain:[0xdbd8ce,.21,.04],
    glass:[0xa4c4ce,.12,.08], tile:[0xa99e8a,.56,.02,'stone'], paleTile:[0xd7ceba,.46,.02,'stone'],
    darkTile:[0x6b7771,.61,.03,'stone'], olive:[0x727952,.9,0,'fabric'], linen:[0xc7aa88,.94,0,'fabric'],
    leather:[0x7c4937,.64,0,'stone'], clay:[0xad5f46,.73,0,'stone'], black:[0x292b27,.65,.08],
    white:[0xe1dcd0,.72,0], green:[0x47664c,.65,0], blue:[0x517575,.73,0], rug:[0xae765f,.96,0,'fabric'],
    paper:[0xdbcaa9,.9,0], woodEnd:[0x876348,.78,0,'wood'], plasterCore:[0xb49b82,.91,0,'stone'],
    glassEdge:[0x83bcc3,.23,.18], metalEdge:[0x454849,.64,.58]
  };
  return Object.fromEntries(Object.entries(options).map(([name,[color,roughness,metalness,texture]]) => {
    const map = texture ? surfaceTexture(texture,color) : null;
    const mat = new THREE.MeshStandardMaterial({color:map?0xffffff:color,map,roughness,metalness});
    if (name === 'glass') {
      mat.transparent = true;
      mat.opacity = .26;
      mat.depthWrite = false;
      mat.side = THREE.DoubleSide;
    }
    return [name,mat];
  }));
}

const unitBox = new THREE.BoxGeometry(1,1,1);
const deadMatrix = new THREE.Matrix4().makeScale(0,0,0);
const loosePropLabels = new Set(['Vase','Mug','Bowl','Books','TV','Potted plant','Lamp']);

function fracturedPanel(mask) {
  const waviness = edge => mask & (1<<edge) ? 1 : 0;
  const bottom=waviness(0),right=waviness(1),top=waviness(2),left=waviness(3);
  // Internal edges share the same offsets so intact panels meet without seams.
  const perimeter=[[-.5,-.5],[-.31,-.5-bottom*.051],[-.07,-.5+bottom*.082],[.21,-.5-bottom*.039],[.5,-.5],
    [.5+right*.064,-.31],[.5-right*.089,-.07],[.5+right*.058,.21],[.5,.5],
    [.21,.5-top*.039],[-.07,.5+top*.082],[-.31,.5-top*.051],[-.5,.5],
    [-.5+left*.058,.21],[-.5-left*.089,-.07],[-.5+left*.064,-.31]];
  const points=[],uvs=[],colors=[];
  function vertex(x,y,z,tint,u=x+.5,v=y+.5) {
    points.push(x,y,z);uvs.push(u,v);colors.push(tint,tint*.995,tint*.97);
  }
  for(let i=0;i<perimeter.length;i++) {
    const [x1,y1]=perimeter[i],[x2,y2]=perimeter[(i+1)%perimeter.length];
    vertex(0,0,.5,1);vertex(x1,y1,.5,1);vertex(x2,y2,.5,1);
    vertex(0,0,-.5,1);vertex(x2,y2,-.5,1);vertex(x1,y1,-.5,1);
    const shade=.49+(i%4)*.082;
    vertex(x1,y1,.5,shade,0,0);vertex(x1,y1,-.5,shade,1,0);vertex(x2,y2,-.5,shade,1,1);
    vertex(x1,y1,.5,shade,0,0);vertex(x2,y2,-.5,shade,1,1);vertex(x2,y2,.5,shade,0,1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return geometry;
}

export function buildWorld(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const materials = makeMaterials();
  const targets = [];
  const colliders = [];
  const furnishingEntries = [];
  const wallChunks = new Map();
  const damaged = new Set();
  const falling = new Map();
  const sparks = [];
  const material = name => typeof name === 'string' ? (materials[name] ?? materials.white) : name;

  function box(parent, mat, x,y,z,w,h,d, options={}) {
    const mesh = new THREE.Mesh(unitBox, material(mat));
    mesh.scale.set(w,h,d);
    mesh.position.set(x,y,z);
    mesh.rotation.y = options.rotationY ?? 0;
    mesh.castShadow = options.castShadow ?? true;
    mesh.receiveShadow = options.receiveShadow ?? true;
    (parent === scene ? root : parent).add(mesh);
    return mesh;
  }

  function addSurface({x,z,w,d,y=-.07,thickness=.14,material:mat='oak'}) {
    return box(root,mat,x,y,z,w,thickness,d,{castShadow:false});
  }

  function addWall({x1,z1,x2,z2,y=0,height=2.85,thickness=.13,material:mat='plaster',kind='plaster',breakable=true,collision=true,label='Partition wall'}) {
    const length = Math.hypot(x2-x1,z2-z1);
    if (length < .01 || height < .01) return;
    const theta = Math.atan2(z1-z2,x2-x1);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),theta);
    if (!breakable) {
      const mesh = box(root,mat,(x1+x2)*.5,y+height*.5,(z1+z2)*.5,length,height,thickness,{rotationY:theta});
      mesh.updateMatrixWorld();
      const entry = {type:'solid', label, active:true,bounds:new THREE.Box3().setFromObject(mesh)};
      if (collision) colliders.push(entry);
      targets.push(mesh);
      return;
    }
    const cols = Math.ceil(length/.54);
    const rows = Math.ceil(height/.55);
    const w = length/cols;
    const h = height/rows;
    const span = {cells:[],cols,rows,theta,quaternion};
    for (let row=0; row<rows; row++) for(let col=0; col<cols; col++) {
      const irregular=kind==='plaster'||kind==='tile'||kind==='masonry';
      const mask=irregular ? (Number(row>0) | Number(col<cols-1)<<1 | Number(row<rows-1)<<2 | Number(col>0)<<3) : -1;
      const key=`${material(mat).id}/${mask}`;
      if (!wallChunks.has(key)) wallChunks.set(key,{material:material(mat),mask,entries:[]});
      const {entries}=wallChunks.get(key);
      const t=(col+.5)/cols;
      const position = new THREE.Vector3(THREE.MathUtils.lerp(x1,x2,t),y+h*(row+.5),THREE.MathUtils.lerp(z1,z2,t));
      const scale = new THREE.Vector3(w,h,thickness);
      const matrix = new THREE.Matrix4().compose(position,quaternion,scale);
      const bounds = new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5)).applyMatrix4(matrix);
      const entry = {type:'wall', position, scale, matrix, bounds, span, row,col,label,kind,active:true,index:entries.length,mat:material(mat)};
      span.cells.push(entry);
      entries.push(entry);
      if (collision) colliders.push(entry);
    }
  }

  function addFurniture(group,{label='Furniture',kind='wood',hp=1,collision=true}={}) {
    if (!group.parent) root.add(group);
    group.updateWorldMatrix(true,true);
    const bounds = new THREE.Box3().setFromObject(group);
    if (bounds.isEmpty()) return;
    const meshes = [];
    const entry = {type:'furniture',label,kind,active:true,bounds,group,meshes,hp,maxHp:hp,
      home:group.position.clone(),homeRotation:group.quaternion.clone(),homeBounds:bounds.clone(),
      restsOnFurniture:!collision&&loosePropLabels.has(label)};
    furnishingEntries.push(entry);
    group.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.userData.breakable = entry;
      if (!mesh.material?.transparent || kind === 'glass') targets.push(mesh);
      meshes.push(mesh);
    });
    if (collision) colliders.push(entry);
  }

  const api = {THREE,scene:root,material,box,addWall,addSurface,addFurniture};
  buildArchitecture(api);
  buildFurnishings(api);
  const panelMaterials=new Map(),panelGeometries=new Map();
  for (const {material:mat,mask,entries} of wallChunks.values()) {
    if (mask>=0 && !panelMaterials.has(mat)) {
      const copy=mat.clone();copy.vertexColors=true;panelMaterials.set(mat,copy);
    }
    if (mask>=0 && !panelGeometries.has(mask)) panelGeometries.set(mask,fracturedPanel(mask));
    const instanced = new THREE.InstancedMesh(panelGeometries.get(mask)??unitBox,mask>=0?panelMaterials.get(mat):mat,entries.length);
    instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instanced.castShadow = instanced.receiveShadow = true;
    instanced.userData.wallEntries = entries;
    for (const entry of entries) {
      entry.mesh = instanced;
      instanced.setMatrixAt(entry.index,entry.matrix);
    }
    instanced.instanceMatrix.needsUpdate=true;
    instanced.computeBoundingSphere();
    root.add(instanced);
    targets.push(instanced);
  }
  root.updateMatrixWorld(true);

  function blocked(x,z,radius=.2) {
    if (x<radius || x>14.78-radius || z<radius || z>9.30-radius) return true;
    if (x<1.95+radius && z<4.80+radius) return true;
    for (const entry of colliders) {
      if (!entry.active) continue;
      const b = entry.bounds;
      if (b.max.y <= .08 || b.min.y >= 1.83) continue;
      const nearestX = THREE.MathUtils.clamp(x,b.min.x,b.max.x);
      const nearestZ = THREE.MathUtils.clamp(z,b.min.z,b.max.z);
      if ((x-nearestX)**2 + (z-nearestZ)**2 < radius**2) return true;
    }
    return false;
  }

  const ray = new THREE.Raycaster();
  ray.far=2.2;
  const center = new THREE.Vector2();
  const rayResults = [];
  function aim(camera) {
    ray.setFromCamera(center,camera);
    rayResults.length=0;
    ray.intersectObjects(targets,false,rayResults);
    for (const hit of rayResults) {
      const object=hit.object;
      const entry = object.userData.wallEntries?.[hit.instanceId] ?? object.userData.breakable;
      if (entry && !entry.active) continue;
      const normal = hit.face?.normal.clone() ?? new THREE.Vector3();
      if (entry?.type === 'wall') normal.applyQuaternion(entry.span.quaternion);
      else normal.transformDirection(object.matrixWorld);
      return {entry,point:hit.point,normal,distance:hit.distance};
    }
    return null;
  }

  function damageMark(hit) {
    const random = randomGenerator(Math.floor(hit.point.x*2300+hit.point.z*100)+783);
    const group = new THREE.Group();
    group.position.copy(hit.point).addScaledVector(hit.normal,.006);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),hit.normal);
    const scarMat = new THREE.MeshBasicMaterial({color:0x44382b,transparent:true,opacity:.64,depthWrite:false,side:THREE.DoubleSide});
    const geo = new THREE.BufferGeometry();
    const points = [];
    for (let i=0;i<7;i++) {
      const angle=i/7*Math.PI*2+random()*.4;
      const end=.036+random()*.075;
      const middle=end*.47;
      const dx=Math.cos(angle), dy=Math.sin(angle);
      points.push(0,0,0, dx*middle-dy*.007,dy*middle+dx*.007,0, dx*end,dy*end,0,
                  0,0,0,dx*end,dy*end,0,dx*middle+dy*.005,dy*middle-dx*.005,0);
    }
    geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    group.add(new THREE.Mesh(geo,scarMat));
    root.add(group);
    sparks.push(group);
    if (sparks.length>24) {
      const oldest=sparks.shift();
      oldest.children[0].geometry.dispose();
      oldest.children[0].material.dispose();
      oldest.removeFromParent();
    }
    return group;
  }

  function dropObjects(support,hit) {
    const top=support.bounds.max.y;
    const point=new THREE.Vector3();
    for(const entry of furnishingEntries) {
      if(!entry.active||!entry.restsOnFurniture||entry.bounds.min.y<.13||falling.has(entry)) continue;
      const {bounds:b}=entry;
      if(Math.abs(b.min.y-top)>.095) continue;
      b.getCenter(point);
      if(point.x<support.bounds.min.x||point.x>support.bounds.max.x||point.z<support.bounds.min.z||point.z>support.bounds.max.z) continue;
      const offset=point.clone().sub(hit.point);
      falling.set(entry,{velocity:new THREE.Vector3(offset.x*.42+hit.normal.x*.21,.32,offset.z*.42+hit.normal.z*.21),
        distance:b.min.y,tip:entry.kind!=='wood'&&entry.group.children.length>0});
    }
  }

  function strike(hit) {
    if (!hit?.entry?.active) return {destroyed:[],alive:hit?.entry??null};
    const entry = hit.entry;
    if (entry.type === 'furniture') {
      entry.hp--;
      if (entry.hp>0) {
        entry.mark?.removeFromParent();
        entry.mark=damageMark(hit);
        entry.group.attach(entry.mark);
        const base = entry.group.position.clone();
        damaged.add({group:entry.group,base,time:.20,amplitude:.016,direction:hit.normal.clone()});
        return {destroyed:[],alive:entry};
      }
      entry.group.visible=false;
      entry.active=false;
      entry.mark?.removeFromParent();
      dropObjects(entry,hit);
      return {destroyed:[entry],alive:null};
    }
    const holes = [entry];
    for (const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
      const col=entry.col+dx, row=entry.row+dy;
      const neighbor=entry.span.cells[row*entry.span.cols+col];
      if (col>=0 && col<entry.span.cols && neighbor?.active &&
          neighbor.position.distanceTo(hit.point)<.66 && (Math.abs(dx)+Math.abs(dy)<2 || Math.random()>.64)) holes.push(neighbor);
    }
    for (const chunk of holes) {
      chunk.active=false;
      chunk.mesh.setMatrixAt(chunk.index,deadMatrix);
      chunk.mesh.instanceMatrix.needsUpdate=true;
    }
    return {destroyed:holes,alive:null};
  }

  function update(dt) {
    const landings=[];
    for (const effect of damaged) {
      effect.time-=dt;
      const {group,base,time,amplitude,direction}=effect;
      group.position.copy(base).addScaledVector(direction,Math.max(0,time)/.20*Math.sin(time*109)*amplitude);
      if (time<=0) damaged.delete(effect);
    }
    for(const [entry,state] of falling) {
      if(!entry.active) {falling.delete(entry);continue;}
      const {group,bounds,kind}=entry;
      const oldBottom=bounds.min.y;
      state.velocity.y-=9.8*dt;
      group.position.addScaledVector(state.velocity,dt);
      if(state.tip) {
        group.rotation.x+=dt*1.2;
        group.rotation.z+=dt*1.7;
      }
      group.updateWorldMatrix(true,true);
      bounds.setFromObject(group);
      const center=bounds.getCenter(new THREE.Vector3());
      let floor=.022;
      for(const surface of colliders) {
        if(!surface.active||surface===entry) continue;
        const b=surface.bounds;
        if(b.max.y>floor&&b.max.y<oldBottom+.027&&center.x>b.min.x&&center.x<b.max.x&&center.z>b.min.z&&center.z<b.max.z) floor=b.max.y;
      }
      if(bounds.min.y>floor || state.velocity.y>0) continue;
      const energy=-state.velocity.y*.14;
      group.position.y+=floor-bounds.min.y;
      group.updateWorldMatrix(true,true);
      bounds.setFromObject(group);
      falling.delete(entry);
      center.y=floor+.07;
      const hit={entry,point:center,normal:new THREE.Vector3(0,1,0)};
      const mustBreak=(kind==='ceramic'||kind==='glass')&&state.distance>.32&&energy>.33;
      landings.push({hit,energy,destroyed:mustBreak?strike(hit).destroyed:[]});
    }
    return landings;
  }

  function reset() {
    for (const {entries} of wallChunks.values()) {
      for (const chunk of entries) {
        chunk.active=true;
        chunk.mesh.setMatrixAt(chunk.index,chunk.matrix);
        chunk.mesh.instanceMatrix.needsUpdate=true;
      }
    }
    for (const entry of furnishingEntries) {
      entry.active=true;
      entry.hp=entry.maxHp;
      entry.group.visible=true;
      entry.group.position.copy(entry.home);
      entry.group.quaternion.copy(entry.homeRotation);
      entry.bounds.copy(entry.homeBounds);
      entry.mark=null;
    }
    root.updateMatrixWorld(true);
    damaged.clear();
    falling.clear();
    for (const mark of sparks.splice(0)) {
      mark.children[0].geometry.dispose();
      mark.children[0].material.dispose();
      mark.removeFromParent();
    }
  }

  function debrisCollision(x,y,z,radius) {
    for (const entry of colliders) {
      if (!entry.active) continue;
      const b=entry.bounds;
      if (x+radius>b.min.x && x-radius<b.max.x && y+radius>b.min.y && y-radius<b.max.y && z+radius>b.min.z && z-radius<b.max.z) return b;
    }
    return null;
  }
  return {root,material,aim,strike,blocked,debrisCollision,update,reset};
}
