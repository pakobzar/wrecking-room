import {THREE,randomGenerator} from './world.js';

export const swingDuration = .86;
export const swingDrive = .385;
export const swingContact = .56;

function bevelBox(w,h,d,bevel,mat) {
  const shape=new THREE.Shape();
  shape.moveTo(-w/2+bevel,-h/2+bevel);
  shape.lineTo(w/2-bevel,-h/2+bevel);
  shape.lineTo(w/2-bevel,h/2-bevel);
  shape.lineTo(-w/2+bevel,h/2-bevel);
  shape.closePath();
  const geo=new THREE.ExtrudeGeometry(shape,{depth:d-2*bevel,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,curveSegments:1});
  geo.translate(0,0,bevel-d/2);
  return new THREE.Mesh(geo,mat);
}

export function makeHammer() {
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(58,1,.025,4);
  const holder=new THREE.Group();
  const grip=new THREE.Group();
  holder.add(grip);
  scene.add(holder);
  const light=new THREE.DirectionalLight(0xffe8cd,3.2);
  light.position.set(-2,3,2);
  scene.add(light,new THREE.HemisphereLight(0xfff2dd,0x896952,2.15));
  const rim=new THREE.DirectionalLight(0x9bbbd1,1.05);
  rim.position.set(2,1,-3);
  scene.add(rim);
  const forgeCanvas=document.createElement('canvas');
  forgeCanvas.width=forgeCanvas.height=128;
  const ctx=forgeCanvas.getContext('2d');
  const mapData=ctx.createImageData(128,128);
  const random=randomGenerator(5126);
  for (let i=0;i<mapData.data.length;i+=4) {
    const k=57+Math.floor(random()*35)+7*Math.sin(i*.017);
    mapData.data.set([k,k+2,k,255],i);
  }
  ctx.putImageData(mapData,0,0);
  ctx.lineWidth=.55;
  for(let i=0;i<155;i++) {
    const x=random()*128,y=random()*128;
    ctx.strokeStyle=i%3===0?'#41443e':'#787970';
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*20,y+(random()-.5)*3);ctx.stroke();
  }
  const forge=new THREE.CanvasTexture(forgeCanvas);
  forge.colorSpace=THREE.SRGBColorSpace;
  forge.wrapS=forge.wrapT=THREE.RepeatWrapping;
  forge.repeat.set(1.1,1.1);
  const head=new THREE.MeshStandardMaterial({map:forge,metalness:.53,roughness:.52});
  const edge=new THREE.MeshStandardMaterial({color:0x8a8c81,metalness:.51,roughness:.42});
  const face=new THREE.MeshStandardMaterial({color:0x666a65,metalness:.57,roughness:.42});
  const varnish=new THREE.MeshStandardMaterial({color:0xb5763d,roughness:.68});
  const line=new THREE.MeshStandardMaterial({color:0x935626,roughness:.76});
  const dark=new THREE.MeshStandardMaterial({color:0x272823,roughness:.94});
  const rubberRidges=new THREE.MeshStandardMaterial({color:0x4a473e,roughness:.91});
  const screw=new THREE.MeshStandardMaterial({color:0x292924,metalness:.34,roughness:.4});

  const handle=new THREE.Mesh(new THREE.CylinderGeometry(.024,.031,.66,16),varnish);
  handle.scale.set(.88,1,.74);
  handle.position.y=.153;
  grip.add(handle);
  const stripes=new THREE.CylinderGeometry(.0248,.0307,.62,16,1,true,.05,.16);
  for (let i=0;i<4;i++) {
    const stripe=new THREE.Mesh(stripes,line);
    stripe.scale.set(.88,1,.74);stripe.position.y=.142;stripe.rotation.y=i*1.55+.22;
    grip.add(stripe);
  }
  const rubber=new THREE.Mesh(new THREE.CylinderGeometry(.031,.035,.25,16),dark);
  rubber.scale.set(.91,1,.77);rubber.position.y=-.125;
  grip.add(rubber);
  for(let i=0;i<9;i++) {
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.0305+i*.00037,.0022,4,12),rubberRidges);
    ring.rotation.x=Math.PI/2;
    ring.scale.y=.82;
    ring.position.y=-.022-i*.024;
    grip.add(ring);
  }
  const core=bevelBox(.265,.111,.121,.014,head);
  core.position.y=.478;grip.add(core);
  for(const side of [-1,1]) {
    const cap=bevelBox(.057,.139,.139,.012,head);
    cap.position.set(side*.111,.478,0);grip.add(cap);
    const steel=bevelBox(.023,.129,.129,.007,edge);
    steel.position.set(side*.139,.478,0);grip.add(steel);
    const contact=bevelBox(.009,.111,.111,.003,face);
    contact.position.set(side*.153,.478,0);grip.add(contact);
  }
  const eye=bevelBox(.071,.014,.072,.005,varnish);
  eye.position.set(0,.531,0);grip.add(eye);
  const wedge=bevelBox(.014,.017,.056,.003,screw);
  wedge.position.set(0,.533,0);grip.add(wedge);
  const stamp=new THREE.CanvasTexture(document.createElement('canvas'));
  const mark=stamp.image;
  mark.width=128;mark.height=70;
  const ink=mark.getContext('2d');
  ink.font='bold 30px monospace';ink.textAlign='center';ink.textBaseline='middle';ink.fillStyle='#c5b29b';ink.fillText('4 KG',64,36);
  stamp.colorSpace=THREE.SRGBColorSpace;stamp.needsUpdate=true;
  const plaque=new THREE.Mesh(new THREE.PlaneGeometry(.114,.062),new THREE.MeshBasicMaterial({map:stamp,transparent:true,opacity:.71,depthWrite:false}));
  plaque.position.set(0,.48,.062);grip.add(plaque);

  const Y=new THREE.Vector3(0,1,0);
  const skin=new THREE.MeshStandardMaterial({color:0xbc805c,roughness:.69});
  const handBack=new THREE.MeshStandardMaterial({color:0xa56e52,roughness:.73});
  const nails=new THREE.MeshStandardMaterial({color:0xdba895,roughness:.54});
  const crease=new THREE.MeshStandardMaterial({color:0x87523c,roughness:.9});
  const canvasMaterial=new THREE.MeshStandardMaterial({color:0x485658,roughness:.91,bumpMap:forge,bumpScale:.008});
  const seam=new THREE.MeshStandardMaterial({color:0x687072,roughness:.95,bumpMap:forge,bumpScale:.006});

  function ellipsoid(parent,mat,position,scale) {
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,14,12),mat);
    mesh.position.set(...position);mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  }

  function curvedTube(parent,mat,points,widths,sides=12) {
    const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
    const rings=points.length*3;
    const frames=path.computeFrenetFrames(rings,false);
    const vertices=[],indices=[];
    for(let i=0;i<=rings;i++) {
      const t=i/rings, location=path.getPointAt(t);
      const key=t*(widths.length-1),low=Math.floor(key);
      const r=THREE.MathUtils.lerp(widths[low],widths[Math.min(low+1,widths.length-1)],key-low);
      for(let j=0;j<sides;j++) {
        const angle=j/sides*Math.PI*2;
        const p=location.clone().addScaledVector(frames.normals[i],Math.cos(angle)*r).addScaledVector(frames.binormals[i],Math.sin(angle)*r);
        vertices.push(p.x,p.y,p.z);
        if(i===rings) continue;
        const a=i*sides+j,b=i*sides+(j+1)%sides;
        indices.push(a,b,a+sides,b,b+sides,a+sides);
      }
    }
    const meshGeometry=new THREE.BufferGeometry();
    meshGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    meshGeometry.setIndex(indices);meshGeometry.computeVertexNormals();
    const mesh=new THREE.Mesh(meshGeometry,mat);
    parent.add(mesh);
    return mesh;
  }

  function makeHand(mirror) {
    const hand=new THREE.Group();
    grip.add(hand);
    hand.scale.x=mirror;
    ellipsoid(hand,skin,[.044,-.038,.027],[.039,.046,.036]).rotation.z=-.20;
    ellipsoid(hand,handBack,[.053,-.057,.033],[.035,.041,.031]).rotation.z=.18;
    ellipsoid(hand,skin,[.066,-.079,.034],[.031,.031,.028]).rotation.z=-.19;
    const fingerWidths=[.0145,.015,.0138,.0114];
    for(let i=0;i<4;i++) {
      const y=.004-i*.024,r=fingerWidths[i],reach=[.042,.047,.043,.032][i];
      curvedTube(hand,skin,[[.047,y,.039],[.016,y+.002,.047],[-.020,y+.002,.038],[-reach,y-.002,.015],[-reach*.81,y-.007,-.007],[-reach*.57,y-.008,-.017]],
        [r*.54,r,r*.96,r*.85,r*.73,.0015]);
      ellipsoid(hand,handBack,[.025,y+.003,.050],[r*.83,r*.50,.007]);
      ellipsoid(hand,nails,[-reach*.90,y-.006,-.009],[.0045,r*.47,.0074]).rotation.y=.26;
      curvedTube(hand,crease,[[-.030,y+.006,.030],[-.029,y,.032],[-.029,y-.006,.028]],[.0008,.001,.0007],5);
    }
    curvedTube(hand,skin,[[.062,-.052,.008],[.055,-.012,-.025],[.022,.023,-.033],[-.007,.021,-.027],[-.020,.005,-.021]],
      [.018,.019,.019,.013,.0018]);
    ellipsoid(hand,nails,[-.013,.015,-.033],[.0098,.009,.003]).rotation.z=.54;
    for(let i=0;i<3;i++) {
      const x=.071+i*.004;
      curvedTube(hand,handBack,[[x,-.069,.058],[x+.006,-.075,.056],[x+.005,-.082,.054]],[.001,.0013,.0007],5);
    }
    const wrist=new THREE.Vector3(.071*mirror,-.085,.031);
    const arm=new THREE.Group();
    scene.add(arm);
    const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.052,.080,1,24),canvasMaterial);
    sleeve.scale.z=.89;
    const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.055,.060,1,22),seam);
    cuff.scale.z=.92;
    const wristMesh=new THREE.Mesh(new THREE.CylinderGeometry(.029,.046,1,24),skin);
    wristMesh.scale.z=.86;
    arm.add(sleeve,cuff,wristMesh);
    for(let i=0;i<2;i++) {
      const thread=new THREE.Mesh(new THREE.TorusGeometry(.0513,.0019,6,24),seam);
      thread.rotation.x=Math.PI/2;thread.scale.y=.89;thread.position.y=.006+i*.012;
      wristMesh.add(thread);
    }
    return {hand,wrist,arm,sleeve,cuff,wristMesh};
  }

  const right=makeHand(1),left=makeHand(-1);
  right.hand.position.y=-.058;
  const end=new THREE.Vector3(),shoulder=new THREE.Vector3(),axis=new THREE.Vector3();
  function fitElbow(model,x,y,z) {
    end.copy(model.wrist).add(model.hand.position).applyQuaternion(holder.quaternion).add(holder.position);
    shoulder.set(x,y,z);
    axis.subVectors(end,shoulder);
    const length=axis.length();
    model.arm.position.copy(end);
    model.arm.quaternion.setFromUnitVectors(Y,axis.normalize());
    const skinLength=Math.min(.123,length*.34);
    model.wristMesh.position.y=-skinLength*.43;
    model.wristMesh.scale.y=skinLength*1.18;
    model.cuff.position.y=-skinLength-.014;
    model.cuff.scale.y=.044;
    model.sleeve.position.y=-(length+skinLength)*.5-.006;
    model.sleeve.scale.y=Math.max(.025,length-skinLength+.024);
  }

  const restEuler=new THREE.Euler(-.38,.15,-.27);
  const restRotation=new THREE.Quaternion().setFromEuler(restEuler);
  const hammerTip=new THREE.Vector3(0,.478,0);
  const rest=new THREE.Vector3(),headAtRest=new THREE.Vector3(),headAt=new THREE.Vector3();
  const q=new THREE.Quaternion(),basis=new THREE.Matrix4();
  function orientation(leading,rise) {
    const x=new THREE.Vector3(...leading).normalize();
    const y=new THREE.Vector3(...rise);
    y.addScaledVector(x,-y.dot(x)).normalize();
    const z=new THREE.Vector3().crossVectors(x,y);
    return new THREE.Quaternion().setFromRotationMatrix(basis.makeBasis(x,y,z));
  }
  const wind=orientation([.84,.22,.49],[.36,.86,-.36]);
  const loaded=orientation([.72,-.05,.69],[.49,.72,-.41]);
  const drive=orientation([-.43,-.52,-.74],[-.30,.82,-.40]);
  const contact=orientation([-.28,-.43,-.858],[-.63,.75,-.08]);
  const through=orientation([-.51,-.59,-.54],[-.83,.52,.16]);
  const recover=orientation([.86,-.09,.49],[-.12,.88,.46]);
  const smooth=(a,b,t)=>THREE.MathUtils.smoothstep(t,a,b);
  let track=null;
  let narrow=false;

  function resize(aspect) {
    camera.aspect=aspect;
    narrow=aspect<.82;
    camera.fov=narrow?67:58;
    camera.updateProjectionMatrix();
    const side=Math.min(.77,camera.aspect*(narrow?.26:.44));
    rest.set(side,narrow?-.60:-.46,narrow?-1.23:-1.14);
    headAtRest.copy(hammerTip).applyQuaternion(restRotation).add(rest);
    const widthScale=narrow?.62:1;
    track=new THREE.CatmullRomCurve3([
      headAtRest.clone(),new THREE.Vector3(.63*widthScale,.15,-.91),
      new THREE.Vector3(.54*widthScale,.65,-.55),new THREE.Vector3(.43*widthScale,.69,-.50),
      new THREE.Vector3(.30*widthScale,.47,-.68),new THREE.Vector3(.041,.067,-1.10),
      new THREE.Vector3(-.163,-.285,-1.33),new THREE.Vector3(.29*widthScale,-.37,-1.15),headAtRest.clone()
    ]);
  }
  const times=[0,.16,.34,swingDrive,.46,swingContact,.66,.82,1];
  const orientations=[restRotation,wind,loaded,loaded,drive,contact,through,recover,restRotation];

  function update(t,bob,swing) {
    const phase=Math.max(0,swing);
    if(swing>=0) {
      let i=0;
      while(i<times.length-2 && phase>times[i+1]) i++;
      let fraction=(phase-times[i])/(times[i+1]-times[i]);
      if(i===0) fraction=1-Math.cos(fraction*Math.PI*.5);
      if(i===times.length-2) fraction=Math.sin(fraction*Math.PI*.5);
      track.getPoint((i+fraction)/(times.length-1),headAt);
      q.copy(orientations[i]).slerp(orientations[i+1],fraction);
      holder.position.copy(headAt).sub(hammerTip.clone().applyQuaternion(q));
      holder.quaternion.copy(q);
    } else {
      holder.position.copy(rest);
      holder.quaternion.copy(restRotation);
    }
    holder.position.y+=Math.sin(t*1.68)*.008+bob*.51;
    const brace=smooth(0,.34,phase)*(1-smooth(.52,.66,phase));
    left.hand.position.y=.023+brace*.214;
    // Both wrists follow the handle. The supporting hand slides down just before impact.
    fitElbow(right,narrow?.36:.74,narrow?-.46:-.56,-.27);
    fitElbow(left,narrow?-.33:-.63,-.62,-.25);
    const support=swing>=0 && phase>.02 && phase<.91;
    left.hand.visible=support;
    left.arm.visible=support;
  }
  return {scene,camera,resize,update};
}
