export const apartmentOutline = [
  [1.95, 0], [14.78, 0], [14.78, 9.30], [0, 9.30],
  [0, 4.80], [1.95, 4.80],
];

const WALL_HEIGHT = 2.85;

function makeRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function surfaceMaterial(THREE, tiled) {
  const canvas = document.createElement('canvas');
  const size = tiled ? 512 : 1024;
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const random = makeRandom(tiled ? 71 : 1059);
  if (tiled) {
    ctx.fillStyle = '#a69987';
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x = col * 128;
        const y = row * 128;
        const tone = Math.round(204 + random() * 14);
        ctx.fillStyle = `rgb(${tone} ${tone - 5} ${tone - 14})`;
        ctx.fillRect(x + 2, y + 2, 125, 125);
        ctx.fillStyle = 'rgba(255,255,255,.23)';
        ctx.fillRect(x + 2, y + 2, 124, 1);
        ctx.fillRect(x + 2, y + 2, 1, 124);
      }
    }
  } else {
    const rows = 7;
    ctx.fillStyle = '#6d4b30';
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < rows; row++) {
      const y = Math.floor(row * size / rows);
      const h = Math.floor((row + 1) * size / rows) - y;
      const stagger = Math.floor(random() * 230);
      const starts = [0, 244 + Math.floor(random() * 55), 490 + Math.floor(random() * 55), 753 + Math.floor(random() * 45), size];
      for (let board = 0; board < 4; board++) {
        const w = starts[board + 1] - starts[board];
        const vl = Math.round(random() * 23) - 11;
        const light = 9 + random() * 7;
        for (const offset of [-size, 0, size]) {
          const x = offset + starts[board] + stagger;
          const color = ctx.createLinearGradient(x, y, x + w, y + h * .35);
          color.addColorStop(0, `rgb(${176 + vl} ${137 + vl} ${99 + vl})`);
          color.addColorStop(.72, `rgb(${177 + vl + light} ${138 + vl + light} ${103 + vl + light})`);
          color.addColorStop(1, `rgb(${170 + vl} ${132 + vl} ${95 + vl})`);
          ctx.fillStyle = color;
          ctx.fillRect(x + 1, y + 1, w - 1, h - 2);
          ctx.fillStyle = 'rgba(248,222,178,.42)';
          ctx.fillRect(x + 1, y + 1, w - 1, 1.2);
          ctx.fillStyle = 'rgba(64,35,19,.15)';
          ctx.fillRect(x + 1, y + h - 3, w - 1, 1);
        }
      }
      for (let strand = 0; strand < 270; strand++) {
        const x = random() * size;
        const gy = y + 3 + random() * (h - 7);
        const w = 20 + random() * 210;
        const bend = (random() - .5) * 6;
        ctx.strokeStyle = random() > .68 ? 'rgba(254,222,160,.19)' : 'rgba(84,53,30,.15)';
        ctx.lineWidth = .4 + random() * 1.35;
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.bezierCurveTo(x + w * .32, gy + bend, x + w * .65, gy - bend * .7, x + w, gy + bend * .45);
        ctx.stroke();
      }
    }
  }
  const bitmap = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < bitmap.data.length; i += 4) {
    const delta = Math.round((random() - .5) * (tiled ? 8 : 13));
    for (let channel = 0; channel < 3; channel++) bitmap.data[i + channel] += delta;
  }
  ctx.putImageData(bitmap, 0, 0);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map, roughness: tiled ? .44 : .66 });
}

export function buildArchitecture({ THREE, scene, material, box, addWall, addSurface, addFurniture }) {
  const oakFloor = surfaceMaterial(THREE, false);
  const tiledFloor = surfaceMaterial(THREE, true);
  const paleDoor = new THREE.MeshStandardMaterial({color: 0xbca78a, roughness: .64});
  const glazing = new THREE.MeshPhysicalMaterial({
    color: 0xa6c5d2,
    transparent: true,
    opacity: .14,
    roughness: .14,
    metalness: 0,
    depthWrite: false,
  });
  const darkFrame = new THREE.MeshStandardMaterial({color: 0x353b36, roughness: .52, metalness: .15});
  const rail = new THREE.MeshStandardMaterial({color: 0x414640, roughness: .7});
  const ceilingLight = new THREE.MeshStandardMaterial({
    color: 0xffe8cb, emissive: 0xffddb0, emissiveIntensity: .55, roughness: .45,
  });

  function overlay(x1, z1, x2, z2, y, mat, repeatX, repeatZ) {
    const geometry = new THREE.PlaneGeometry(x2 - x1, z2 - z1);
    geometry.rotateX(-Math.PI / 2);
    const uv = geometry.attributes.uv;
    const position = geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (position.getX(i) + (x1 + x2) / 2) / repeatX,
        -(position.getZ(i) + (z1 + z2) / 2) / repeatZ);
    }
    const plane = new THREE.Mesh(geometry, mat);
    plane.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    plane.receiveShadow = true;
    scene.add(plane);
  }

  function area(x1, z1, x2, z2, floorMat = 'oak') {
    const x = (x1 + x2) / 2;
    const z = (z1 + z2) / 2;
    const w = x2 - x1;
    const d = z2 - z1;
    addSurface({x, z, w, d, material: floorMat});
    if (floorMat === 'oak') overlay(x1, z1, x2, z2, .004, oakFloor, 5.0, 1.36);
    if (floorMat !== 'concrete') {
      addSurface({x, z, w, d, y: WALL_HEIGHT + .045, thickness: .09, material: 'ceiling'});
    }
  }

  area(2.95, 0, 14.78, 4.80);
  area(0, 4.80, 14.78, 9.30);
  area(1.95, 0, 2.95, 4.80, 'concrete');
  overlay(7.10, .04, 10.12, 2.70, .009, tiledFloor, 1.32, 1.32);
  overlay(2.95, 3.45, 5.72, 5.22, .009, tiledFloor, 1.32, 1.32);

  const span = (x1, z1, x2, z2, options = {}) => addWall({x1, z1, x2, z2, ...options});
  const perimeter = {thickness: .24, material: 'plaster', kind: 'masonry', label: 'Exterior wall'};
  const partition = {thickness: .13, material: 'plaster', kind: 'plaster', label: 'Partition wall'};
  const wetWall = {...partition, material: 'paleTile', kind: 'tile', label: 'Bathroom wall'};

  function strip(x1, z1, x2, z2, y, height, depth, mat, options, parent = scene) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    box(parent, mat, (x1 + x2) / 2, y, (z1 + z2) / 2, Math.hypot(dx, dz), height, depth, {
      rotationY: -Math.atan2(dz, dx),
      ...options,
    });
  }

  function frame(parent, x1, z1, x2, z2, floor, height, depth, mat, width = .055) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const ux = dx / length;
    const uz = dz / length;
    for (const [x, z] of [[x1, z1], [x2 - ux * width, z2 - uz * width]]) {
      strip(x, z, x + ux * width, z + uz * width, floor + height / 2, height, depth, mat, {}, parent);
    }
    strip(x1, z1, x2, z2, floor + height - width / 2, width, depth, mat, {}, parent);
  }

  function window(x1, z1, x2, z2, sill, top, divisions = 1) {
    span(x1, z1, x2, z2, {...perimeter, height: sill});
    span(x1, z1, x2, z2, {...perimeter, y: top, height: WALL_HEIGHT - top});
    const surround = new THREE.Group();
    frame(surround, x1, z1, x2, z2, sill, top - sill, .115, darkFrame);
    strip(x1, z1, x2, z2, sill + .027, .054, .115, darkFrame, {}, surround);
    strip(x1, z1, x2, z2, sill - .013, .037, .360, 'trim', {}, surround);
    const dx = x2 - x1;
    const dz = z2 - z1;
    for (let i = 0; i < divisions; i++) {
      const pane = new THREE.Group();
      const inset = .026 / Math.hypot(dx, dz);
      const a = i / divisions + inset;
      const b = (i + 1) / divisions - inset;
      strip(x1 + dx * a, z1 + dz * a, x1 + dx * b, z1 + dz * b, (sill + top) / 2,
        top - sill - .10, .014, glazing, {castShadow: false, receiveShadow: false}, pane);
      addFurniture(pane, {label: 'Windowpane', kind: 'glass', collision: false});
    }
    for (let i = 1; i < divisions; i++) {
      const x = x1 + dx * i / divisions;
      const z = z1 + dz * i / divisions;
      const width = .05 / Math.hypot(dx, dz);
      strip(x - dx * width / 2, z - dz * width / 2, x + dx * width / 2, z + dz * width / 2,
        (sill + top) / 2, top - sill - .05, .080, darkFrame, {}, surround);
    }
    addFurniture(surround, {label: 'Window frame', kind: 'metal', collision: false});
  }

  function doorway(x1, z1, x2, z2, opt, opening = null) {
    const top = 2.16;
    span(x1, z1, x2, z2, { ...opt, y: top, height: WALL_HEIGHT - top });
    const casing = new THREE.Group();
    frame(casing, x1, z1, x2, z2, 0, top, opt.thickness + .024, 'trim', .045);
    addFurniture(casing, {label: 'Door frame', kind: 'wood', collision: false});
    if (opening) doorPanel(...opening);
  }

  function doorPanel(x1, z1, x2, z2, visibleSide = 1, exterior = false) {
    const group = new THREE.Group();
    const depth = exterior ? .091 : .041;
    strip(x1, z1, x2, z2, 1.074, 2.10, depth, 'walnut', {}, group);
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const nx = -dz * visibleSide / length;
    const nz = dx * visibleSide / length;
    if (exterior) {
      for (const at of [.17, .78]) {
        const x = x1 + dx * at + nx * .049;
        const z = z1 + dz * at + nz * .049;
        strip(x, z, x + dx * .013, z + dz * .013, 1.10, 1.87, .012, paleDoor, {}, group);
      }
    }
    const x = x1 + dx * .87 + nx * (depth / 2 + .014);
    const z = z1 + dz * .87 + nz * (depth / 2 + .014);
    strip(x - dx * .10, z - dz * .10, x, z, 1.00, .023, .031, 'brass', {}, group);
    addFurniture(group, {label: exterior ? 'Entry door' : 'Door', kind: 'wood', hp: exterior ? 2 : 1});
  }

  function entrance(x1, z1, x2, z2, visibleSide) {
    doorway(x1, z1, x2, z2, perimeter);
    doorPanel(x1, z1, x2, z2, visibleSide, true);
  }

  // Exterior envelope and the original narrow slab along the kitchen.
  span(2.95, 0, 3.61, 0, perimeter);
  window(3.61, 0, 4.69, 0, 1.07, 2.42);
  span(4.69, 0, 14.78, 0, perimeter);
  span(14.78, 0, 14.78, .72, perimeter);
  window(14.78, .72, 14.78, 2.95, .61, 2.46, 2);
  span(14.78, 2.95, 14.78, 3.52, perimeter);
  entrance(14.78, 3.52, 14.78, 4.62, 1);
  span(14.78, 4.62, 14.78, 6.00, perimeter);
  window(14.78, 6.00, 14.78, 8.24, .73, 2.43, 2);
  span(14.78, 8.24, 14.78, 9.30, perimeter);
  span(14.78, 9.30, 0, 9.30, {...perimeter, label: 'Shared wall'});
  span(0, 9.30, 0, 8.77, perimeter);
  entrance(0, 8.77, 0, 7.68, 1);
  span(0, 7.68, 0, 6.10, perimeter);
  window(0, 6.10, 0, 5.02, .83, 2.37);
  span(0, 5.02, 0, 4.80, perimeter);
  span(0, 4.80, 2.95, 4.80, perimeter);
  span(2.95, 4.80, 2.95, 0, {...partition, thickness: .19, label: 'Kitchen wall'});
  span(1.95, 0, 1.95, 4.80, {
    y: 2.60, height: .24, thickness: .18, breakable: false, material: 'concrete',
    kind: 'masonry', label: 'Beam',
  });
  box(scene, 'concrete', 1.95, 1.33, .13, .20, 2.66, .22);
  span(1.95, 3.82, 1.95, 4.15, {
    height: 2.60, thickness: .18, material: 'concrete', kind: 'masonry', label: 'Column',
  });
  for (const [x1, z1, x2, z2] of [[1.96, 0, 1.96, 4.80], [1.96, .02, 2.91, .02], [1.96, 4.79, 2.91, 4.79]]) {
    strip(x1, z1, x2, z2, 1.04, .055, .065, rail);
    strip(x1, z1, x2, z2, .16, .038, .046, rail);
    const count = Math.floor(Math.hypot(x2 - x1, z2 - z1) / .24);
    for (let i = 0; i <= count; i++) {
      const fraction = i / count;
      box(scene, rail, x1 + (x2 - x1) * fraction, .58, z1 + (z2 - z1) * fraction, .025, .90, .025);
    }
  }

  // Bathroom walls and their original door positions.
  span(7.10, 0, 7.10, 2.70, wetWall);
  span(7.10, 2.70, 7.82, 2.70, wetWall);
  doorway(7.82, 2.70, 8.79, 2.70, wetWall, [8.82, 2.80, 8.90, 3.72]);
  span(8.79, 2.70, 10.12, 2.70, wetWall);
  span(10.12, 0, 10.12, 2.70, wetWall);
  span(2.95, 3.45, 5.72, 3.45, wetWall);
  span(5.72, 3.45, 5.72, 5.22, wetWall);
  span(2.95, 5.22, 3.58, 5.22, wetWall);
  doorway(3.58, 5.22, 4.44, 5.22, wetWall, [3.55, 5.33, 2.75, 5.33, -1]);

  // Living room, the central hall and the two bedroom entries.
  span(10.12, 2.70, 10.12, 4.10, partition);
  doorway(10.12, 4.10, 10.12, 5.15, partition, [10.22, 4.12, 10.22, 3.18]);
  span(10.12, 5.15, 14.78, 5.15, partition);
  span(4.44, 5.22, 7.20, 5.22, partition);
  doorway(7.20, 5.22, 8.14, 5.22, partition, [7.18, 5.33, 6.28, 5.33, -1]);
  doorway(10.12, 5.15, 10.12, 6.22, partition, [10.22, 6.20, 10.22, 7.18, -1]);
  span(8.10, 6.22, 8.10, 6.99, partition);
  span(8.10, 6.99, 10.12, 6.99, partition);
  span(10.12, 6.22, 10.12, 6.99, partition);
  span(9.16, 6.33, 9.16, 9.30, partition);
  span(9.01, 2.70, 9.01, 3.60, partition);

  function closet(x1, x2, front, back) {
    const direction = Math.sign(back - front);
    const depth = Math.abs(back - front);
    span(x1, front, x2, front, {...partition, y: 2.17, height: WALL_HEIGHT - 2.17});
    const casing = new THREE.Group();
    frame(casing, x1, front, x2, front, 0, 2.17, .13, 'trim', .039);
    addFurniture(casing, {label: 'Closet frame', kind: 'wood', collision: false});
    for (const y of [.12, 1.82]) {
      const shelf = new THREE.Group();
      box(shelf, 'oak', (x1 + x2) / 2, y, (front + back) / 2 + direction * .025, x2 - x1 - .085, .065, depth - .14);
      addFurniture(shelf, {label: 'Shelf', kind: 'wood', collision: false});
    }
    const rail = new THREE.Group();
    box(rail, 'steel', (x1 + x2) / 2, 1.71, (front + back) / 2, x2 - x1 - .09, .024, .024);
    addFurniture(rail, {label: 'Closet rod', kind: 'metal', collision: false});
    span(x1 + .04, front + direction * .02, x1 + .25, front + direction * .27, {
      y: .045, height: 2.04, thickness: .035, material: 'walnut', kind: 'wood',
      collision: false, label: 'Closet door',
    });
  }

  closet(9.03, 10.09, 3.59, 2.76);
  closet(8.13, 9.13, 6.24, 6.95);
  closet(9.19, 10.09, 6.24, 6.95);

  // Cut skirting into breakable lengths along the envelope.
  for (const [x1, z1, x2, z2] of [
    [2.95, .126, 7.02, .126], [10.19, .126, 14.66, .126],
    [14.653, .12, 14.653, 3.50], [14.653, 4.64, 14.653, 9.17],
    [.12, 9.173, 14.66, 9.173], [.128, 4.95, .128, 7.65], [.128, 8.79, .128, 9.19],
    [.128, 4.928, 2.86, 4.928],
  ]) span(x1, z1, x2, z2, {height: .086, thickness: .025, material: 'trim', kind: 'wood', collision: false, label: 'Baseboard'});

  const trimRing = new THREE.CylinderGeometry(.093, .093, .020, 26);
  const lampFace = new THREE.CylinderGeometry(.068, .068, .009, 24);
  for (const [x, z] of [
    [4.35, 1.0], [5.94, 1.0], [4.35, 2.83], [5.94, 2.83],
    [8.42, 1.33], [4.32, 4.27], [7.35, 4.19], [9.33, 4.79], [9.25, 5.84],
    [11.04, 1.02], [13.68, 1.02], [11.04, 3.54], [13.68, 3.54],
    [1.20, 5.75], [2.30, 7.95], [5.96, 7.95],
    [11.09, 8.08], [13.65, 6.28], [13.65, 8.08],
  ]) {
    for (const [geometry, mat, y] of [[trimRing, material('trim'), 2.837], [lampFace, ceilingLight, 2.825]]) {
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      scene.add(mesh);
    }
  }

  buildExterior({THREE, scene, box});
}

function buildExterior({THREE, scene, box}) {
  const lawn = new THREE.MeshLambertMaterial({color: 0x68765a});
  const stone = new THREE.MeshLambertMaterial({color: 0xaaa59a});
  const cladding = new THREE.MeshLambertMaterial({color: 0x9c8b73});
  const bark = new THREE.MeshLambertMaterial({color: 0x776c53});
  const darkWindow = new THREE.MeshLambertMaterial({color: 0x556365});
  const leaves = new THREE.MeshLambertMaterial({color: 0xffffff});
  const adjacentFloor = new THREE.MeshLambertMaterial({color: 0x847e72});
  const adjacentWall = new THREE.MeshLambertMaterial({color: 0xb1a697});
  const adjacentDoor = new THREE.MeshLambertMaterial({color: 0x655c50});
  const random = makeRandom(83525);
  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), lawn);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.set(10, -2.50, 4);
  terrain.receiveShadow = true;
  scene.add(terrain);
  box(scene, stone, 8.35, -1.32, 2.40, 12.84, 2.36, 4.80, {castShadow: false});
  box(scene, stone, 7.39, -1.32, 8.34, 14.78, 2.36, 7.08, {castShadow: false});
  box(scene, adjacentFloor, 7.39, -.07, 10.57, 14.78, .14, 2.54, {castShadow: false});
  box(scene, adjacentWall, 7.39, 2.91, 10.57, 14.78, .12, 2.54, {castShadow: false});
  box(scene, adjacentWall, 7.39, 1.414, 11.84, 14.78, 2.828, .18, {castShadow: false});
  for (const x of [.03, 14.75]) {
    box(scene, adjacentWall, x, 1.414, 10.57, .12, 2.828, 2.54, {castShadow: false});
  }
  for (const x of [3.30, 10.76]) {
    box(scene, adjacentDoor, x, 1.056, 11.73, .91, 2.112, .058, {castShadow: false});
    box(scene, stone, x + .32, 1.01, 11.69, .09, .021, .033, {castShadow: false});
  }
  box(scene, stone, 19.50, -2.47, 2.2, 1.65, .045, 64, {castShadow: false});
  box(scene, stone, 3.90, -2.47, -5.2, 20, .045, 1.35, {castShadow: false});

  const facadeWindows = [];
  for (const [x, z, w, d, h, floors] of [
    [39, -12.1, 5.3, 7.8, 6.5, 3], [44, 2.5, 6.6, 9.3, 9.8, 4],
    [49, 15, 7.5, 10.0, 5.9, 3], [23, -34, 9.0, 6.3, 7.45, 3],
    [5.7, -31.7, 9.0, 6.8, 5.7, 2], [-14.0, 2.8, 5.8, 11.6, 6.7, 3],
  ]) {
    box(scene, cladding, x, h / 2 - 2.50, z, w, h, d, {castShadow: false});
    box(scene, stone, x, h - 2.42, z, w + .25, .18, d + .25, {castShadow: false});
    for (let floor = 0; floor < floors; floor++) {
      const y = -.99 + floor * (h / floors);
      for (let i = 1; i <= 4; i++) {
        facadeWindows.push([x - w / 2 - .016, y, z - d / 2 + d * i / 5, .045, 1.0, .88]);
        facadeWindows.push([x + w / 2 + .016, y, z - d / 2 + d * i / 5, .045, 1.0, .88]);
        facadeWindows.push([x - w / 2 + w * i / 5, y, z + d / 2 + .016, .86, 1.0, .045]);
      }
    }
  }

  const instance = new THREE.Object3D();
  const panes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), darkWindow, facadeWindows.length);
  facadeWindows.forEach(([x, y, z, w, h, d], i) => {
    instance.position.set(x, y, z);
    instance.scale.set(w, h, d);
    instance.updateMatrix();
    panes.setMatrixAt(i, instance.matrix);
  });
  scene.add(panes);

  const crowns = [];
  for (const [x, z, height] of [
    [22.0, -1.2, 5.5], [23.5, 6.8, 6.6], [24.0, 11.6, 5.6],
    [20.0, 17, 6.8], [29.0, 3.0, 6.7], [30, -7, 7.9], [26, -17, 6.2],
    [8, -11, 5.6], [2, -10.5, 5.4], [-4, -5, 6.7], [-8, 4.4, 6.5],
    [-6, 9.85, 5.8], [12.8, -19.8, 7.5], [17.4, -13.2, 6.8],
  ]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.085, .16, height * .76, 8), bark);
    trunk.position.set(x, -2.50 + height * .38, z);
    scene.add(trunk);
    for (let i = 0; i < 11; i++) {
      const a = i * 2.39996;
      const spread = Math.sqrt(i / 11) * height * .25;
      crowns.push([
        x + Math.cos(a) * spread,
        -2.50 + height * (.93 - i * .028) + random() * .55,
        z + Math.sin(a) * spread,
        height * (.155 + random() * .071),
      ]);
    }
  }
  const canopy = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), leaves, crowns.length);
  const foliageColors = [0x657542, 0x74844a, 0x879257, 0x53673f, 0x8f995e];
  crowns.forEach(([x, y, z, r], i) => {
    instance.position.set(x, y, z);
    instance.rotation.set(random(), random(), random() * .35);
    instance.scale.set(r, r * (.86 + random() * .37), r * (1 + random() * .35));
    instance.updateMatrix();
    canopy.setMatrixAt(i, instance.matrix);
    canopy.setColorAt(i, new THREE.Color(foliageColors[Math.floor(random() * foliageColors.length)]));
  });
  scene.add(canopy);
}
