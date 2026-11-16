export function buildFurnishings({ THREE, material, box, addFurniture }) {
  const standard = (color, roughness = .78, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const mats = Object.fromEntries([
    'oak', 'walnut', 'brass', 'steel', 'porcelain', 'glass', 'linen', 'black', 'paper'
  ].map(name => [name, material(name)]));
  const cream = mats.linen.clone();
  cream.color.set('#ded3bb');
  const canvas = mats.linen.clone();
  canvas.color.set('#c6b69b');
  const forest = mats.linen.clone();
  forest.color.set('#657057');
  const terracotta = mats.linen.clone();
  terracotta.color.set('#ad6147');
  const mutedBlue = mats.linen.clone();
  mutedBlue.color.set('#708b93');
  const lacquer = standard('#738071', .55);
  const paleWood = mats.oak.clone();
  paleWood.color.multiplyScalar(1.13);
  const stone = standard('#c9c3ad', .78);
  const soil = standard('#40302a', 1);
  const earthen = standard('#b06d51', .52);
  const sage = standard('#889586', .31);
  const tanCeramic = standard('#caad86', .46);
  const chrome = standard('#a6ada9', .18, .66);
  const screen = standard('#20282a', .2, .36);
  const petals = ['#5e7549', '#72875b', '#495e39', '#83956a']
    .map(color => new THREE.MeshStandardMaterial({ color, roughness: .76, side: THREE.DoubleSide }));
  const warmLamp = new THREE.MeshStandardMaterial({ color: '#f9d09b', emissive: '#ffc47d', emissiveIntensity: .47, roughness: .7, side: THREE.DoubleSide });
  const shade = new THREE.MeshStandardMaterial({ color: '#d7b98b', emissive: '#c38a4d', emissiveIntensity: .13, roughness: .94, side: THREE.DoubleSide });
  const darkBraided = standard('#4c4437', .88);
  const bookCloths = ['#908c63', '#c48c65', '#c0a483', '#626a69', '#a47a71', '#666052', '#a1977b'].map(color => standard(color));
  const vector = (x, y, z) => new THREE.Vector3(x, y, z);
  const geometryCache = new Map();
  let randomState = 20519;
  const random = () => ((randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0) / 4294967296);

  function object(x, z, rotation = 0, y = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    return group;
  }

  function finish(group, label, kind, hp = 1, collision = true) {
    batchMeshes(group);
    addFurniture(group, { label, kind, hp, collision });
    return group;
  }

  function batchMeshes(group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const batches = new Map();
    group.traverse(part => {
      if (!part.isMesh || part.isInstancedMesh || part.material.transparent) return;
      const key = [part.material.id, part.castShadow, part.receiveShadow].join('|');
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(part);
    });
    for (const parts of batches.values()) {
      if (parts.length === 1) continue;
      const vertexCount = parts.reduce((count, part) => count + part.geometry.attributes.position.count, 0);
      const indexCount = parts.reduce((count, part) => count + (part.geometry.index?.count ?? part.geometry.attributes.position.count), 0);
      const positionData = new Float32Array(vertexCount * 3);
      const normalData = new Float32Array(vertexCount * 3);
      const uvData = new Float32Array(vertexCount * 2);
      const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
      const transform = new THREE.Matrix4();
      const normalTransform = new THREE.Matrix3();
      const point = vector(0, 0, 0);
      let vertexOffset = 0, indexOffset = 0;
      for (const part of parts) {
        const { position, normal, uv } = part.geometry.attributes;
        const index = part.geometry.index;
        transform.multiplyMatrices(inverse, part.matrixWorld);
        normalTransform.getNormalMatrix(transform);
        for (let i = 0; i < position.count; i++) {
          const offset = vertexOffset + i;
          point.fromBufferAttribute(position, i).applyMatrix4(transform).toArray(positionData, offset * 3);
          point.fromBufferAttribute(normal, i).applyNormalMatrix(normalTransform).toArray(normalData, offset * 3);
          if (uv) {
            uvData[offset * 2] = uv.getX(i);
            uvData[offset * 2 + 1] = uv.getY(i);
          }
        }
        for (let i = 0; i < (index?.count ?? position.count); i++) {
          indices[indexOffset++] = vertexOffset + (index ? index.getX(i) : i);
        }
        vertexOffset += position.count;
        part.removeFromParent();
      }
      const combined = new THREE.BufferGeometry();
      combined.setAttribute('position', new THREE.BufferAttribute(positionData, 3));
      combined.setAttribute('normal', new THREE.BufferAttribute(normalData, 3));
      combined.setAttribute('uv', new THREE.BufferAttribute(uvData, 2));
      combined.setIndex(new THREE.BufferAttribute(indices, 1));
      const first = parts[0];
      const part = mesh(group, combined, first.material, 0, 0, 0);
      part.castShadow = first.castShadow;
      part.receiveShadow = first.receiveShadow;
    }
  }

  function mesh(parent, geometry, surface, x, y, z) {
    const part = new THREE.Mesh(geometry, surface);
    part.position.set(x, y, z);
    part.castShadow = true;
    part.receiveShadow = true;
    parent.add(part);
    return part;
  }

  function rounded(parent, surface, x, y, z, width, height, depth, bevel = .03) {
    const radius = Math.min(bevel, width / 2, height / 2, depth / 2);
    const key = ['round', width, height, depth, radius].join('|');
    if (!geometryCache.has(key)) {
      const segments = 5;
      const source = new THREE.BoxGeometry(1, 1, 1, segments, segments, segments);
      const positions = source.attributes.position;
      const normals = source.attributes.normal;
      const align = [width / 2 - radius, height / 2 - radius, depth / 2 - radius];
      const normal = vector(0, 0, 0);
      for (let index = 0; index < positions.count; index++) {
        const vx = positions.getX(index), vy = positions.getY(index), vz = positions.getZ(index);
        const sx = Math.sign(vx), sy = Math.sign(vy), sz = Math.sign(vz);
        normal.set(vx - sx * .1, vy - sy * .1, vz - sz * .1).normalize();
        positions.setXYZ(index, align[0] * sx + normal.x * radius, align[1] * sy + normal.y * radius, align[2] * sz + normal.z * radius);
        normals.setXYZ(index, normal.x, normal.y, normal.z);
      }
      geometryCache.set(key, source);
    }
    return mesh(parent, geometryCache.get(key), surface, x, y, z);
  }

  function cylinder(parent, surface, x, y, z, top, bottom, height, sides = 16, open = false) {
    const key = ['cylinder', top, bottom, height, sides, open].join('|');
    if (!geometryCache.has(key)) {
      geometryCache.set(key, new THREE.CylinderGeometry(top, bottom, height, sides, 1, open));
    }
    return mesh(parent, geometryCache.get(key), surface, x, y, z);
  }

  function tube(parent, surface, points, radius, smooth = true) {
    const vertices = points.map(point => vector(...point));
    const curve = smooth ? new THREE.CatmullRomCurve3(vertices, false, 'centripetal') : new THREE.CurvePath();
    if (!smooth) {
      vertices.slice(1).forEach((end, index) => curve.add(new THREE.LineCurve3(vertices[index], end)));
    }
    return mesh(parent, new THREE.TubeGeometry(curve, smooth ? 18 : vertices.length * 3, radius, 7, false), surface, 0, 0, 0);
  }

  function ellipse(parent, surface, x, y, z, radius, height, widthScale = 1, depthScale = 1) {
    const part = cylinder(parent, surface, x, y, z, radius, radius, height, 28);
    part.scale.set(widthScale, 1, depthScale);
    return part;
  }

  function profile(parent, surface, x, y, z, points, segments = 24) {
    return mesh(parent, new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), segments), surface, x, y, z);
  }

  function rug(x, z, width, depth, color, stripeColor = '#e0c6a0', rotation = 0) {
    const rugCanvas = document.createElement('canvas');
    rugCanvas.width = 512;
    rugCanvas.height = 512;
    const context = rugCanvas.getContext('2d');
    context.fillStyle = color;
    context.fillRect(0, 0, 512, 512);
    for (let index = 0; index < 10500; index++) {
      context.fillStyle = index % 3 ? '#ffffff' : '#202019';
      context.globalAlpha = random() * .18;
      const px = random() * 512, py = random() * 512;
      context.fillRect(px, py, 1 + random() * 5, .6 + random() * 1.2);
    }
    context.globalAlpha = .72;
    context.strokeStyle = stripeColor;
    for (const inset of [11, 18, 37]) {
      context.lineWidth = inset === 18 ? 3.5 : 1.2;
      context.strokeRect(inset, inset, 512 - inset * 2, 512 - inset * 2);
    }
    const texture = new THREE.CanvasTexture(rugCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const textile = new THREE.MeshStandardMaterial({ map: texture, bumpMap: texture, bumpScale: .013, roughness: 1 });
    const group = object(x, z, rotation);
    const top = mesh(group, new THREE.PlaneGeometry(width, depth), textile, 0, .016, 0);
    top.rotation.x = -Math.PI / 2;
    top.castShadow = false;
    const binding = standard(color, 1);
    box(group, binding, 0, .007, 0, width, .009, depth, { castShadow: false });
    const end = new THREE.InstancedMesh(new THREE.BoxGeometry(.011, .005, .042), binding, 74);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < 74; index++) {
      const px = (index % 37 - 18) * width / 37;
      const sign = index < 37 ? -1 : 1;
      matrix.makeTranslation(px, .008, sign * (depth / 2 + .019 + random() * .01));
      end.setMatrixAt(index, matrix);
    }
    end.receiveShadow = true;
    group.add(end);
    finish(group, 'Rug', 'fabric', 2, false);
  }

  function foliage(x, z, scale = 1, y = 0, color = earthen) {
    const group = object(x, z, 0, y);
    profile(group, color, 0, 0, 0, [[0, 0], [.15, 0], [.16, .015], [.203, .29], [.206, .33], [.187, .33], [.178, .30], [.179, .26], [0, .25]]);
    cylinder(group, soil, 0, .279, 0, .181, .176, .022, 20);
    const stem = standard('#6f7952');
    for (let index = 0; index < 13; index++) {
      const azimuth = index * 2.39996;
      const outward = .19 + random() * .28;
      const height = .49 + random() * .83;
      const dx = Math.cos(azimuth), dz = Math.sin(azimuth);
      const base = vector(dx * outward * .42, height + .18, dz * outward * .42);
      const tip = vector(dx * outward * 1.64, height + .22 - random() * .29, dz * outward * 1.64);
      tube(group, stem, [[dx * .025, .27, dz * .02], [base.x * .47, height * .62 + .13, base.z * .47], [base.x, base.y, base.z]], .0065);
      const side = vector(-dz, (random() - .5) * .4, dx);
      const positions = [];
      const indices = [];
      for (let row = 0; row <= 9; row++) {
        const t = row / 9;
        const spine = base.clone().lerp(tip, t);
        const width = Math.pow(Math.sin(t * Math.PI), .75) * (.085 + outward * .14);
        spine.y += Math.sin(t * Math.PI) * .069;
        for (const sideFactor of [-1, 0, 1]) {
          const point = spine.clone().addScaledVector(side, sideFactor * width);
          point.y -= Math.abs(sideFactor) * width * .35;
          positions.push(point.x, point.y, point.z);
        }
        if (row < 9) {
          const a = row * 3;
          indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
        }
      }
      const leaf = new THREE.BufferGeometry();
      leaf.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      leaf.setIndex(indices);
      leaf.computeVertexNormals();
      mesh(group, leaf, petals[index % petals.length], 0, 0, 0);
    }
    group.scale.setScalar(scale);
    return finish(group, 'Potted plant', 'ceramic', 1, y === 0 && scale >= .85);
  }

  function bookStack(x, z, y, rotation = 0, count = 3) {
    const group = object(x, z, rotation, y);
    for (let index = 0; index < count; index++) {
      const book = new THREE.Group();
      const width = .235 - index * .025;
      const depth = .173 - index * .015;
      const height = .041 + index * .007;
      const surface = bookCloths[(index * 3 + Math.floor(x + z)) % bookCloths.length];
      book.position.set((index - 1) * .012, .024 + index * .044, -.009 * index);
      book.rotation.y = (index - 1) * .105;
      group.add(book);
      rounded(book, surface, 0, 0, 0, width, height, depth, .009);
      box(book, mats.paper, .003, 0, .003, width - .027, height - .011, depth - .008);
      box(book, surface, -width / 2 + .006, 0, 0, .012, height, depth);
      box(book, mats.brass, -.044, height / 2 + .001, .025, width * .32, .001, .002);
    }
    return finish(group, 'Books', 'wood', 1, false);
  }

  function vessel(x, z, y, style = 'vase') {
    const group = object(x, z, 0, y);
    if (style === 'vase') {
      profile(group, earthen, 0, 0, 0, [[0, 0], [.061, 0], [.085, .018], [.107, .071], [.096, .137], [.05, .19], [.045, .24], [.055, .25], [.055, .261], [.043, .261], [.032, .22], [.035, .176], [0, .135]]);
      for (let index = 0; index < 4; index++) {
        const lean = (index - 1.5) * .033;
        const tall = .39 + index % 2 * .077;
        tube(group, darkBraided, [[0, .17, 0], [lean / 2, .32, .013 * index], [lean, tall, -.013 * index]], .0028);
        const bud = cylinder(group, tanCeramic, lean, tall, -.013 * index, .012, .005, .032, 7);
        bud.rotation.z = -lean * 3;
      }
    } else if (style === 'mug') {
      profile(group, sage, 0, 0, 0, [[0, 0], [.037, 0], [.045, .009], [.048, .078], [.045, .082], [.041, .079], [.04, .013], [0, .012]], 22);
      tube(group, sage, [[.043, .068, 0], [.068, .072, 0], [.075, .044, 0], [.065, .027, 0], [.043, .026, 0]], .006);
    } else {
      profile(group, tanCeramic, 0, 0, 0, [[0, 0], [.071, 0], [.11, .018], [.142, .061], [.136, .061], [.106, .023], [.062, .01], [0, .01]]);
    }
    return finish(group, { vase: 'Vase', mug: 'Mug', bowl: 'Bowl' }[style], 'ceramic', 1, false);
  }

  function art(x, z, y, width, height, style = 0, rotation = 0) {
    const image = document.createElement('canvas');
    image.width = 384;
    image.height = 384;
    const context = image.getContext('2d');
    const palette = [
      ['#e2d3b7', '#bc6f4d', '#515747', '#dbb483', '#b6a787'],
      ['#dfd7c7', '#a79477', '#4b6260', '#c77e67', '#8d977b'],
      ['#d6c3a4', '#7b7969', '#a0533a', '#cab47c', '#605750']
    ][style % 3];
    context.fillStyle = palette[0];
    context.fillRect(0, 0, 384, 384);
    context.fillStyle = palette[3];
    context.beginPath();
    context.ellipse(284, 123, 51, 51, 0, 0, Math.PI * 2);
    context.fill();
    const landscape = (color, coordinates) => {
      const [origin, controlOne, controlTwo, destination] = coordinates;
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(...origin);
      context.bezierCurveTo(...controlOne, ...controlTwo, ...destination);
      context.lineTo(384, 384);
      context.lineTo(0, 384);
      context.fill();
    };
    landscape(palette[4], [[0, 212], [130, 121], [151, 286], [384, 174]]);
    landscape(palette[1], [[0, 253], [142, 334], [194, 106 + (style % 3) * 21], [384, 254]]);
    landscape(palette[2], [[0, 298], [119, 201], [188, 394], [384, 273]]);
    for (let index = 0; index < 7200; index++) {
      context.fillStyle = index % 2 ? '#33281b' : '#fff9e5';
      context.globalAlpha = random() * .155;
      context.fillRect(random() * 384, random() * 384, random() * 3 + .35, .75);
    }
    const texture = new THREE.CanvasTexture(image);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const group = object(x, z, rotation, y);
    box(group, mats.walnut, 0, 0, 0, width, height, .037);
    box(group, mats.paper, 0, 0, .022, width - .038, height - .04, .012);
    mesh(group, new THREE.PlaneGeometry(width - .14, height - .14), new THREE.MeshStandardMaterial({ map: texture, roughness: .92 }), 0, 0, .029);
    return finish(group, 'Framed print', 'wood', 1, false);
  }

  function sofa(x, z) {
    const group = object(x, z);
    rounded(group, forest, 0, .27, .035, 2.73, .34, .90, .08);
    rounded(group, forest, 0, .62, -.34, 2.73, .86, .23, .09);
    for (const side of [-1, 1]) {
      rounded(group, forest, side * 1.258, .451, .075, .216, .58, .865, .075);
      for (const front of [-1, 1]) {
        const leg = cylinder(group, mats.walnut, side * 1.17, .071, front * .325, .036, .027, .142, 12);
        leg.rotation.z = -side * .08;
      }
    }
    for (const position of [-.764, 0, .764]) {
      rounded(group, forest, position, .478, .145, .742, .163, .653, .063);
      const back = rounded(group, forest, position, .755, -.219, .745, .47, .186, .069);
      back.rotation.x = -.16;
      box(group, forest, position, .486, .468, .65, .011, .011, { castShadow: false });
    }
    for (const [position, surface, angle] of [[-.95, cream, -.22], [.91, terracotta, .25], [.66, canvas, .12]]) {
      const pillow = rounded(group, surface, position, .711, .045, .345, .344, .16, .075);
      pillow.rotation.set(-.28, angle * .63, angle);
    }
    const blanket = new THREE.PlaneGeometry(.47, .62, 20, 18);
    const positions = blanket.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const bx = positions.getX(i), t = (positions.getY(i) + .31) / .62;
      const droop = Math.max(0, t - .52);
      positions.setXYZ(i, bx - .731 + .013 * Math.sin(t * 7 + bx * 7), .566 - droop * .59 + .012 * Math.cos(bx * 57 + t * 2), .16 + Math.min(t, .52) * .61 + .08 * Math.sin(droop * 2.6));
    }
    blanket.computeVertexNormals();
    const throwLinen = cream.clone();
    throwLinen.side = THREE.DoubleSide;
    mesh(group, blanket, throwLinen, 0, 0, 0);
    return finish(group, 'Sofa', 'fabric', 3);
  }

  function armchair(x, z, rotation, upholstery = canvas) {
    const group = object(x, z, rotation);
    rounded(group, upholstery, 0, .42, .003, .69, .20, .61, .08);
    const back = rounded(group, upholstery, 0, .685, -.232, .71, .43, .145, .073);
    back.rotation.x = -.19;
    for (const side of [-1, 1]) {
      for (const [front, offset] of [[.23, .027], [-.237, -.039]]) {
        const leg = cylinder(group, mats.walnut, side * .295, .181, front, .025, .019, .362, 10);
        leg.rotation.set(offset * 3, 0, side * .11);
      }
      tube(group, mats.walnut, [[side * .33, .27, .231], [side * .384, .553, .23], [side * .367, .607, .06], [side * .345, .58, -.251]], .031);
    }
    return finish(group, 'Armchair', 'fabric', 2);
  }

  function coffeeTable(x, z, rotation) {
    const group = object(x, z, rotation);
    ellipse(group, mats.walnut, 0, .408, 0, .57, .063, 1.16, .65);
    ellipse(group, paleWood, 0, .437, 0, .567, .018, 1.155, .648);
    ellipse(group, mats.walnut, 0, .342, 0, .57, .08, 1.07, .55);
    for (const [tx, tz] of [[-.42, -.17], [.43, -.17], [-.25, .22], [.25, .22]]) {
      const leg = cylinder(group, mats.walnut, tx, .174, tz, .052, .034, .348, 13);
      leg.rotation.z = -tx * .24;
    }
    return finish(group, 'Coffee table', 'wood', 2);
  }

  function lamp(x, z, y, style = 'floor') {
    const group = object(x, z, 0, y);
    if (style === 'pendant') {
      cylinder(group, mats.brass, 0, 2.82, 0, .083, .083, .041);
      cylinder(group, darkBraided, 0, 2.514, 0, .0045, .0045, .587, 6);
      cylinder(group, mats.brass, 0, 2.202, 0, .028, .027, .062);
      profile(group, shade, 0, 2.145, 0, [[.272, -.117], [.274, -.11], [.26, -.09], [.198, -.02], [.098, .027], [.046, .031], [.043, .018]], 36);
      cylinder(group, warmLamp, 0, 2.028, 0, .245, .245, .008, 32);
    } else {
      const scale = style === 'floor' ? 1 : .37;
      profile(group, mats.brass, 0, 0, 0, [[0, .009], [.168, .009], [.182, .022], [.17, .037], [.065, .042], [.025, .046], [.017, .062]]);
      cylinder(group, mats.brass, 0, .737, 0, .014, .016, 1.42, 12);
      cylinder(group, shade, 0, 1.48, 0, .189, .258, .388, 36, true);
      cylinder(group, warmLamp, 0, 1.294, 0, .236, .236, .009, 32);
      cylinder(group, warmLamp, 0, 1.667, 0, .177, .177, .008, 32);
      for (const [cy, radius] of [[1.289, .258], [1.672, .189]]) {
        const lip = mesh(group, new THREE.TorusGeometry(radius, .004, 5, 36), tanCeramic, 0, cy, 0);
        lip.rotation.x = Math.PI / 2;
      }
      group.scale.setScalar(scale);
    }
    return finish(group, 'Lamp', 'metal', 1, style === 'floor');
  }

  function cabinet(x, z, rotation, width, height, depth, drawers, surface = mats.walnut) {
    const group = object(x, z, rotation);
    rounded(group, surface, 0, height / 2 + .067, 0, width, height - .13, depth, .018);
    rounded(group, surface, 0, height - .012, 0, width + .035, .048, depth + .034, .018);
    for (const side of [-1, 1]) {
      for (const front of [-1, 1]) {
        cylinder(group, mats.black, side * (width / 2 - .088), .075, front * (depth / 2 - .071), .026, .022, .15, 10);
      }
    }
    if (drawers) {
      for (let index = 0; index < 3; index++) {
        const cy = .151 + (index + .5) * (height - .192) / 3;
        rounded(group, surface, 0, cy, depth / 2 + .011, width - .042, (height - .192) / 3 - .014, .033, .008);
        rounded(group, mats.brass, 0, cy + .013, depth / 2 + .039, .12, .012, .014, .005);
      }
    } else {
      for (const side of [-1, 1]) {
        rounded(group, surface, side * (width * .25 - .005), height / 2 + .059, depth / 2 + .01, width * .5 - .025, height - .185, .034, .007);
        rounded(group, mats.brass, side * .071, height - .124, depth / 2 + .039, .072, .012, .015, .005);
      }
    }
    return finish(group, drawers ? 'Dresser' : 'Cabinet', 'wood', 2);
  }

  function television(x, z, rotation, y) {
    const group = object(x, z, rotation, y);
    rounded(group, mats.black, 0, .399, 0, 1.209, .686, .068, .019);
    rounded(group, screen, 0, .402, .036, 1.169, .646, .009, .011);
    for (const side of [-1, 1]) {
      box(group, mats.black, side * .401, .023, -.008, .043, .047, .243, { rotationY: side * .23 });
    }
    box(group, warmLamp, .53, .077, .041, .016, .003, .002, { castShadow: false });
    return finish(group, 'TV', 'glass', 1, false);
  }

  function bed(x, z, rotation, cover, label) {
    const group = object(x, z, rotation);
    rounded(group, mats.walnut, 0, .251, 1.032, 1.66, .265, 2.125, .039);
    for (const side of [-1, 1]) {
      for (const end of [.2, 1.9]) cylinder(group, mats.walnut, side * .716, .08, end, .038, .026, .16, 10);
    }
    rounded(group, mats.walnut, 0, .681, -.04, 1.76, 1.18, .099, .048);
    rounded(group, canvas, 0, .82, .025, 1.639, .741, .095, .075);
    for (const side of [-1, 0, 1]) {
      rounded(group, canvas, side * .478, .819, .075, .014, .668, .003, .002);
    }
    rounded(group, cream, 0, .465, 1.028, 1.60, .225, 2.037, .079);
    for (const side of [-1, 1]) {
      const pillow = rounded(group, cream, side * .371, .603, .341, .614, .415, .109, .051);
      pillow.rotation.set(-Math.PI / 2 + .14, side * .119, 0);
      const accent = rounded(group, cover, side * .386, .608, .603, .346, .263, .134, .052);
      accent.rotation.x = -Math.PI * .36;
      accent.rotation.z = side * .114;
    }
    rounded(group, cover, 0, .566, 1.308, 1.662, .128, 1.445, .051);
    rounded(group, cover, 0, .462, 2.012, 1.665, .231, .108, .039);
    rounded(group, cream, 0, .643, 1.704, 1.661, .042, .35, .02);
    return finish(group, label, 'fabric', 3);
  }

  function dresserMirror(x, z, y, rotation = 0) {
    const group = object(x, z, rotation, y);
    const frame = cylinder(group, mats.brass, 0, 0, 0, .385, .385, .039, 40);
    frame.rotation.x = Math.PI / 2;
    const reflection = new THREE.MeshStandardMaterial({ color: '#a3a6a0', roughness: .21, metalness: .44 });
    const pane = mesh(group, new THREE.CircleGeometry(.359, 40), reflection, 0, 0, .024);
    pane.castShadow = false;
    return finish(group, 'Mirror', 'glass', 1, false);
  }

  function writingDesk(x, z, rotation) {
    const group = object(x, z, rotation);
    rounded(group, mats.oak, 0, .748, 0, 1.18, .084, .589, .03);
    rounded(group, mats.oak, .307, .66, .005, .46, .135, .5, .017);
    rounded(group, mats.brass, .307, .677, .269, .105, .013, .017, .004);
    for (const side of [-1, 1]) {
      for (const front of [-1, 1]) {
        const leg = cylinder(group, mats.walnut, side * .489, .353, front * .205, .037, .027, .711, 10);
        leg.rotation.z = -side * .065;
      }
    }
    return finish(group, 'Writing desk', 'wood', 2);
  }

  function kitchenCabinet(x, z, width, rotation, variant = 'doors') {
    const group = object(x, z, rotation);
    const depth = .631;
    box(group, mats.black, 0, .069, -.022, width - .031, .138, depth - .051);
    box(group, lacquer, 0, .477, -.018, width, .782, depth - .036);
    if (variant !== 'sink') rounded(group, stone, 0, .898, 0, width, .061, depth + .028, .018);
    if (variant === 'sink') {
      const margins = (width - .48) / 2;
      for (const sign of [-1, 1]) {
        box(group, stone, sign * (.24 + margins / 2), .898, 0, margins, .061, depth + .028);
        box(group, stone, 0, .898, sign * .288, .48, .061, .085);
      }
      rounded(group, chrome, 0, .897, 0, .515, .014, .496, .022);
      rounded(group, chrome, 0, .9, -.224, .478, .016, .051, .012);
      rounded(group, screen, 0, .905, .016, .438, .008, .38, .018);
      rounded(group, chrome, 0, .907, .026, .331, .009, .257, .016);
      const drain = cylinder(group, mats.black, .064, .914, .049, .031, .031, .004, 16);
      drain.castShadow = false;
      tube(group, chrome, [[.11, .918, -.247], [.11, 1.123, -.247], [.11, 1.202, -.175], [.11, 1.192, -.075], [.11, 1.142, -.041]], .0125);
      cylinder(group, chrome, .11, .929, -.247, .026, .027, .021);
    }
    if (variant === 'drawers') {
      for (let index = 0; index < 3; index++) {
        const y = .254 + index * .245;
        rounded(group, lacquer, 0, y, .306, width - .017, .226, .038, .006);
        rounded(group, mats.brass, 0, y + .065, .337, .133, .011, .019, .004);
      }
    } else if (variant === 'oven') {
      rounded(group, mats.black, 0, .549, .306, width - .031, .58, .041, .009);
      rounded(group, screen, 0, .528, .328, width - .111, .392, .014, .014);
      rounded(group, mats.steel, 0, .741, .348, width - .103, .02, .021, .005);
      for (const direction of [-1, 1]) {
        const dial = cylinder(group, mats.steel, direction * .179, .801, .336, .022, .022, .02, 16);
        dial.rotation.x = Math.PI / 2;
      }
      rounded(group, mats.black, 0, .939, 0, width - .064, .026, .514, .011);
      for (const px of [-.145, .145]) {
        for (const pz of [-.126, .126]) {
          const burner = mesh(group, new THREE.TorusGeometry(.087, .0025, 5, 27), mats.steel, px, .953, pz);
          burner.rotation.x = Math.PI / 2;
        }
      }
    } else {
      for (const side of [-1, 1]) {
        const px = side * width / 4;
        rounded(group, lacquer, px, .493, .306, width / 2 - .012, .711, .038, .007);
        rounded(group, lacquer, px, .493, .326, width / 2 - .09, .61, .008, .005);
        rounded(group, mats.brass, px - side * .067, .753, .341, .063, .012, .019, .005);
      }
    }
    return finish(group, variant === 'oven' ? 'Range' : variant === 'sink' ? 'Kitchen sink' : 'Kitchen cabinet', variant === 'oven' ? 'metal' : 'wood', 2);
  }

  function wallCabinet(x, z, rotation, width) {
    const group = object(x, z, rotation, 1.556);
    rounded(group, mats.oak, 0, .315, 0, width, .63, .302, .012);
    for (const side of [-1, 1]) {
      const px = side * width / 4;
      rounded(group, mats.oak, px, .313, .157, width * .5 - .011, .603, .028, .006);
      rounded(group, mats.brass, px - side * .066, .071, .179, .064, .012, .021, .006);
    }
    box(group, warmLamp, 0, -.003, .079, width - .079, .008, .024, { castShadow: false });
    return finish(group, 'Wall cabinet', 'wood', 2, false);
  }

  function fridge(x, z, rotation) {
    const group = object(x, z, rotation);
    const enamel = standard('#c4c4b5', .53, .2);
    rounded(group, enamel, 0, .932, -.025, .691, 1.864, .651, .058);
    for (const [height, size] of [[.628, 1.142], [1.535, .63]]) {
      rounded(group, enamel, 0, height, .314, .687, size, .125, .046);
      tube(group, mats.brass, [[-.25, height - .149, .381], [-.25, height - .107, .411], [-.25, height + .112, .411], [-.25, height + .156, .381]], .011);
    }
    return finish(group, 'Refrigerator', 'metal', 3);
  }

  function vanity(x, z, rotation, width) {
    const group = object(x, z, rotation);
    rounded(group, mats.oak, 0, .518, 0, width, .596, .423, .025);
    for (const y of [.367, .646]) {
      rounded(group, mats.oak, 0, y, .221, width - .032, .254, .035, .012);
      rounded(group, mats.brass, 0, y + .057, .246, .115, .015, .017, .005);
    }
    rounded(group, mats.porcelain, 0, .827, 0, width + .03, .071, .449, .029);
    profile(group, mats.porcelain, 0, .858, .024, [[0, 0], [.116, 0], [.153, .032], [.173, .084], [.17, .094], [.153, .094], [.138, .046], [.081, .022], [0, .019]], 32);
    cylinder(group, chrome, 0, .883, .024, .023, .023, .006, 14);
    tube(group, chrome, [[.101, .863, -.14], [.101, 1.038, -.14], [.061, 1.061, -.103], [.003, 1.013, -.087]], .011);
    return finish(group, 'Bathroom vanity', 'ceramic', 2);
  }

  function toilet(x, z, rotation) {
    const group = object(x, z, rotation);
    rounded(group, mats.porcelain, 0, .51, -.144, .385, .642, .213, .064);
    rounded(group, mats.porcelain, 0, .846, -.144, .391, .061, .227, .018);
    const foot = profile(group, mats.porcelain, 0, .017, .071, [[0, 0], [.111, 0], [.137, .014], [.143, .047], [.098, .12], [.1, .195], [.164, .264], [.183, .354], [.167, .38], [.144, .38], [.117, .338], [.092, .258], [0, .248]], 30);
    foot.scale.z = 1.36;
    const lid = ellipse(group, mats.porcelain, 0, .416, .071, .184, .045, 1, 1.33);
    lid.rotation.x = .007;
    const lever = cylinder(group, chrome, .081, .88, -.121, .027, .027, .008, 20);
    lever.castShadow = false;
    return finish(group, 'Toilet', 'ceramic', 2);
  }

  function bathtub(x, z, rotation, width = .743, length = 1.65, height = .49, shower = true) {
    const group = object(x, z, rotation);
    const contour = (outline, w, l, r) => {
      outline.moveTo(-w / 2 + r, -l / 2);
      outline.lineTo(w / 2 - r, -l / 2);
      outline.quadraticCurveTo(w / 2, -l / 2, w / 2, -l / 2 + r);
      outline.lineTo(w / 2, l / 2 - r);
      outline.quadraticCurveTo(w / 2, l / 2, w / 2 - r, l / 2);
      outline.lineTo(-w / 2 + r, l / 2);
      outline.quadraticCurveTo(-w / 2, l / 2, -w / 2, l / 2 - r);
      outline.lineTo(-w / 2, -l / 2 + r);
      outline.quadraticCurveTo(-w / 2, -l / 2, -w / 2 + r, -l / 2);
    };
    const shell = new THREE.Shape(), cutout = new THREE.Path();
    contour(shell, width, length, .121);
    contour(cutout, width - .145, length - .19, .14);
    shell.holes.push(cutout);
    const surface = new THREE.ExtrudeGeometry(shell, { depth: Math.max(.022, height - .098), bevelEnabled: true, bevelSize: .014, bevelThickness: .013, bevelSegments: 2, curveSegments: 6 });
    const rim = mesh(group, surface, mats.porcelain, 0, .079, 0);
    rim.rotation.x = -Math.PI / 2;
    rounded(group, mats.porcelain, 0, .073, 0, width - .022, .114, length - .028, .085);
    cylinder(group, chrome, 0, .134, length * .28, .025, .025, .009, 16);
    tube(group, chrome, [[0, height, -length * .461], [0, height + .113, -length * .461], [0, height + .124, -length * .403], [0, height + .088, -length * .356]], .014);
    for (const side of [-1, 1]) cylinder(group, chrome, side * .108, height + .02, -length * .46, .029, .03, .04, 14);
    finish(group, 'Bathtub', 'ceramic', 3);
    if (!shower) return;
    const divider = object(x, z, rotation);
    const glass = mats.glass.clone();
    glass.opacity = .26;
    glass.transparent = true;
    glass.depthWrite = false;
    rounded(divider, glass, -width * .468, 1.086, -.316, .012, 1.19, length * .53, .004).castShadow = false;
    for (const edge of [-1, 1]) {
      box(divider, chrome, -width * .468, 1.086, -.316 + edge * length * .265, .019, 1.211, .018);
      box(divider, chrome, -width * .468, 1.086 + edge * .603, -.316, .02, .019, length * .53);
    }
    finish(divider, 'Glass shower screen', 'glass', 1, false);
    const fixture = object(x, z, rotation);
    tube(fixture, chrome, [[width / 2 + .037, .847, -.371], [width / 2 + .037, 1.854, -.371], [width / 2 + .023, 2.017, -.371], [.148, 2.045, -.371], [.129, 2.004, -.371]], .01);
    cylinder(fixture, chrome, .129, 1.99, -.371, .086, .092, .024, 24);
    cylinder(fixture, mats.black, .129, 1.974, -.371, .077, .077, .006, 24);
    finish(fixture, 'Shower fixture', 'metal', 1, false);
  }

  function stool(x, z, label, surface = mats.oak) {
    const group = object(x, z);
    ellipse(group, surface, 0, .483, 0, .174, .049, 1, 1);
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      const leg = cylinder(group, surface, Math.sin(angle) * .115, .241, Math.cos(angle) * .115, .024, .018, .483, 9);
      leg.rotation.set(Math.cos(angle) * .19, 0, -Math.sin(angle) * .19);
    }
    return finish(group, label, 'wood', 1);
  }

  // Living area, with an open route along the west wall to the hall.
  rug(12.65, 2.21, 2.81, 2.22, '#9a715a', '#e9c9a3');
  sofa(12.115, .887);
  armchair(14.03, 2.323, -1.06, canvas);
  coffeeTable(12.71, 2.31, -.15);
  bookStack(12.468, 2.38, .447, -.18);
  vessel(12.913, 2.208, .447);
  vessel(13.118, 2.393, .447, 'mug');
  art(11.836, .141, 1.713, .817, .781, 0);
  art(12.733, .144, 1.703, .634, .678, 1);
  foliage(14.014, .623, 1.14);
  lamp(10.723, .729, 0);
  lamp(12.733, 2.052, 0, 'pendant');
  cabinet(10.447, 2.271, Math.PI / 2, 1.46, .509, .471, false);
  television(10.48, 2.281, Math.PI / 2, .52);
  bookStack(10.493, 1.752, .52, 1.3, 2);
  foliage(10.52, 2.83, .36, .52, sage);
  cabinet(13.32, 4.83, Math.PI, 1.07, .729, .431, true, mats.oak);
  lamp(13.65, 4.81, .733, 'table');
  vessel(12.96, 4.79, .733, 'bowl');

  // Built-in storage and appliances keep the kitchen's approach open.
  kitchenCabinet(3.332, .462, .59, 0, 'drawers');
  kitchenCabinet(4.081, .462, .899, 0, 'sink');
  kitchenCabinet(4.848, .462, .633, 0, 'doors');
  kitchenCabinet(5.472, .462, .613, 0, 'oven');
  kitchenCabinet(6.101, .462, .635, 0, 'drawers');
  fridge(6.737, .495, 0);
  wallCabinet(4.981, .284, 0, .876);
  wallCabinet(5.888, .284, 0, .912);
  kitchenCabinet(3.446, 3.093, .715, Math.PI, 'doors');
  kitchenCabinet(4.165, 3.093, .709, Math.PI, 'drawers');
  kitchenCabinet(4.88, 3.093, .713, Math.PI, 'doors');
  vessel(3.615, 3.053, .932, 'bowl');
  vessel(4.336, 3.093, .931, 'vase');
  vessel(6.089, .49, .93, 'mug');
  foliage(4.868, .419, .29, .936, tanCeramic);
  rug(4.721, 1.742, .806, 1.914, '#a5a082', '#e5d6bd', Math.PI / 2);
  lamp(4.993, 1.939, 0, 'pendant');

  // West and east bedrooms.
  rug(2.725, 7.592, 2.418, 2.739, '#a29877');
  bed(2.858, 9.12, Math.PI, mutedBlue, 'Bed');
  cabinet(1.631, 8.928, Math.PI, .528, .496, .442, true, mats.oak);
  cabinet(4.07, 8.928, Math.PI, .528, .496, .442, true, mats.oak);
  lamp(1.651, 8.95, .5, 'table');
  bookStack(4.069, 8.91, .5, -.12, 2);
  art(2.739, 9.168, 1.804, .783, .618, 2, Math.PI);
  cabinet(5.526, 8.842, Math.PI, 1.39, .91, .562, true);
  dresserMirror(5.587, 9.167, 1.59, Math.PI);
  vessel(5.985, 8.87, .919);
  writingDesk(.494, 6.584, Math.PI / 2);
  armchair(1.191, 6.596, -Math.PI / 2, forest);
  bookStack(.534, 6.805, .791, -.17);
  foliage(.47, 5.403, .88, 0, sage);
  art(5.742, 5.38, 1.65, .643, .679, 0);
  art(6.42, 5.38, 1.65, .511, .63, 1);
  foliage(7.826, 8.844, 1.03, 0, earthen);

  rug(12.43, 7.801, 2.451, 2.396, '#a6735a', '#e4c6a0');
  bed(12.15, 9.125, Math.PI, terracotta, 'Bed');
  cabinet(10.959, 8.914, Math.PI, .533, .497, .434, true, mats.oak);
  cabinet(13.304, 8.925, Math.PI, .542, .497, .441, true, mats.oak);
  lamp(13.304, 8.946, .5, 'table');
  vessel(10.96, 8.901, .503, 'mug');
  art(12.185, 9.168, 1.72, .879, .65, 1, Math.PI);
  writingDesk(14.341, 6.64, -Math.PI / 2);
  armchair(13.737, 6.404, Math.PI / 2, mutedBlue);
  bookStack(14.345, 6.928, .791, .52);
  cabinet(12.552, 5.567, 0, 1.329, .765, .492, true, mats.walnut);
  foliage(14.276, 8.703, .87, 0, tanCeramic);
  art(12.508, 5.286, 1.516, .757, .553);

  // Fixtures follow the two wet rooms drawn on the plan.
  vanity(7.482, 1.905, Math.PI / 2, .626);
  dresserMirror(7.21, 1.903, 1.518, Math.PI / 2);
  toilet(7.821, .474, 0);
  bathtub(9.579, 1.171, 0, .79, 1.93, .482);
  stool(9.313, 2.28, 'Stool');
  vanity(3.52, 3.813, 0, .615);
  dresserMirror(3.52, 3.594, 1.499);
  toilet(4.315, 3.824, 0);
  bathtub(5.197, 4.332, 0, .734, 1.367, .355);
}
