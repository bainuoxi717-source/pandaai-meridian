import { addIdentity } from './identity';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { canvasTexture, glowTexture, makePalette, signTexture } from './materials';
import type { Palette } from './materials';
import { seeded } from './math';
import type { Collider, Door } from './types';

export class TacticalWorld {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  readonly palette: Palette;
  readonly doors: Door[] = [];
  readonly evidence = new THREE.Group();
  readonly intelPositions = [new THREE.Vector3(2.7, .72, 9.5), new THREE.Vector3(-2.35, 1.05, -20.3), new THREE.Vector3(5.25, 1.05, -30.4)];
  readonly intelNodes: THREE.Group[] = [];
  readonly extraction = new THREE.Vector3(.7, 0, 20);
  readonly entry = new THREE.Vector3(0, 1.8, -16);
  readonly evidencePosition = new THREE.Vector3(-4.2, 1, -33.1);
  readonly rain: THREE.LineSegments;
  readonly reflection: Reflector;
  private batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private textures: THREE.Texture[];
  private glow: THREE.Texture;
  private lampSprites: THREE.Sprite[] = [];
  private lightSources: { position: THREE.Vector3; color: number; intensity: number }[] = [];
  private lightPool: THREE.PointLight[] = [];
  private random = seeded(49);

  constructor(readonly scene: THREE.Scene) {
    const { materials, textures } = makePalette();
    this.palette = materials; this.textures = textures;
    this.glow = glowTexture(); this.textures.push(this.glow);
    scene.add(this.group);
    addIdentity(scene);
    this.addSky();
    this.addLighting();
    this.addBuildings();
    this.addYard();
    this.addInterior();
    this.addIntelNodes();
    this.addVehicle();
    this.addDistantCity();
    for (let i = 0; i < 4; i++) { const light = new THREE.PointLight(0xb5c1d4, 0, 23, 2); this.group.add(light); this.lightPool.push(light); }
    this.flush();
    this.reflection = this.addGround();
    this.rain = this.addRain();
  }

  private geometry(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    geometry.applyMatrix4(matrix);
    if (!this.batches.has(material)) this.batches.set(material, []);
    this.batches.get(material)!.push(geometry);
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, collision: false | Collider['kind'] = false, ry = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const pos = geo.attributes.position, normals = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(normals.getX(i)), ny = Math.abs(normals.getY(i));
      if (nx > .5) uv.setXY(i, (pos.getZ(i) + z) * .45, (pos.getY(i) + y) * .45);
      else if (ny > .5) uv.setXY(i, (pos.getX(i) + x) * .45, (pos.getZ(i) + z) * .45);
      else uv.setXY(i, (pos.getX(i) + x) * .45, (pos.getY(i) + y) * .45);
    }
    this.geometry(geo, material, x, y, z, 0, ry);
    if (collision) {
      const size = new THREE.Vector3(Math.abs(w * Math.cos(ry)) + Math.abs(d * Math.sin(ry)), h, Math.abs(d * Math.cos(ry)) + Math.abs(w * Math.sin(ry)));
      this.colliders.push({ box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, y, z), size), enabled: true, kind: collision });
    }
  }

  private cylinder(rt: number, rb: number, h: number, x: number, y: number, z: number, material: THREE.Material, rotation: [number, number, number] = [0, 0, 0], segments = 12) {
    this.geometry(new THREE.CylinderGeometry(rt, rb, h, segments), material, x, y, z, ...rotation);
  }

  private flush() {
    this.batches.forEach((geometries, material) => {
      const merged = mergeGeometries(geometries, false);
      if (merged) {
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = !(material instanceof THREE.MeshBasicMaterial);
        mesh.receiveShadow = true;
        this.group.add(mesh);
      }
      geometries.forEach(g => g.dispose());
    });
    this.batches.clear();
  }

  private sign(text: string, x: number, y: number, z: number, width: number, height: number, options: Parameters<typeof signTexture>[1] = {}, ry = 0, rx = 0) {
    const texture = signTexture(text, options); this.textures.push(texture);
    const mat = new THREE.MeshPhongMaterial({ map: texture, shininess: 12, transparent: options?.bg === 'transparent', emissive: '#a3aab7', emissiveMap: texture, emissiveIntensity: .06, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, 0); this.group.add(mesh);
    return mesh;
  }

  private beam(from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material) {
    const delta = new THREE.Vector3().subVectors(to, from);
    const geometry = new THREE.CylinderGeometry(radius, radius, delta.length(), 8);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    geometry.applyQuaternion(quaternion);
    const mid = from.clone().add(to).multiplyScalar(.5);
    this.geometry(geometry, material, mid.x, mid.y, mid.z);
  }

  private lamp(x: number, y: number, z: number, color: number, intensity: number, side = 0) {
    const p = this.palette;
    this.box(.62, .12, .35, x, y + .08, z, p.darkSteel);
    this.box(.43, .025, .24, x, y + .005, z, color === 0xb5c1d4 ? p.light : p.coldLight);
    this.lightSources.push({ position: new THREE.Vector3(x, y - .1, z + side * .25), color, intensity });
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color, transparent: true, opacity: .22, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.set(x, y - .07, z + .06); sprite.scale.set(2.5, 2.5, 1); this.group.add(sprite); this.lampSprites.push(sprite);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(.12, 2.2, y, 24, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { color: { value: new THREE.Color(color) } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv; uniform vec3 color; void main(){float a=pow(vUv.y,1.8)*0.019; gl_FragColor=vec4(color,a);}',
    }));
    cone.position.set(x, y / 2, z); this.group.add(cone);
  }

  private addSky() {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 vPos;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){vec3 d=normalize(vPos);float h=max(d.y,0.);vec3 c=mix(vec3(.14,.195,.205),vec3(.025,.05,.065),pow(h,.6));
      vec2 p=d.xz/(h+.25)*3.;float n=noise(p)*.5+noise(p*2.)*.25+noise(p*4.)*.125;c+=vec3(.03,.035,.035)*(n-.45);gl_FragColor=vec4(c,1.);}`,
    }));
    this.group.add(sky);
  }

  private addLighting() {
    this.scene.background = new THREE.Color('#1c2a2c');
    this.scene.fog = new THREE.FogExp2('#23383b', .018);
    this.scene.add(new THREE.HemisphereLight('#a4c0cb', '#363b44', 1.6));
    const moon = new THREE.DirectionalLight('#a2c2d3', 2.1);
    moon.position.set(-15, 28, 16); moon.target.position.set(0, 0, -7); moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    Object.assign(moon.shadow.camera, { left: -28, right: 28, top: 36, bottom: -30, near: 1, far: 80 });
    moon.shadow.bias = -.00035; moon.shadow.normalBias = .045;
    this.scene.add(moon, moon.target);
    const fill = new THREE.DirectionalLight('#c1c7d1', .55); fill.position.set(5, 8, 22); this.scene.add(fill);
  }

  private addBuildings() {
    const p = this.palette;
    // The service road funnels toward an actual two-room warehouse.
    this.box(12, 8.3, 54, -11.3, 4.15, -3, p.brick, 'wall');
    this.box(.33, 1.6, 54.1, -5.17, .8, -3, p.darkConcrete);
    this.box(.35, .3, 55, -5.15, 7.9, -3, p.concrete);
    this.box(.24, .2, 55, -5.1, 4.75, -3, p.darkSteel);
    for (let z = -26; z < 22; z += 5.2) {
      this.box(.31, 8.6, .28, -5.0, 4.3, z, p.concrete);
      this.box(.08, 1.8, 3.65, -4.96, 6.15, z + 2.5, p.darkSteel);
      this.box(.09, 1.54, 3.38, -4.9, 6.15, z + 2.5, z % 2 ? p.window : p.glass);
      for (let zz = 0; zz < 4; zz++) this.box(.13, 1.7, .07, -4.82, 6.15, z + 1.25 + zz * .8, p.darkSteel);
      this.box(.14, .06, 3.6, -4.8, 6.16, z + 2.5, p.darkSteel);
    }
    // Ground-floor shutters, ventilation, pipework, weathered signage.
    for (const z of [6, -6, -19]) {
      this.box(.15, 3.1, 3.8, -4.96, 1.75, z, p.darkSteel);
      for (let y = .3; y < 3.25; y += .14) this.box(.08, .028, 3.65, -4.85, y, z, p.steel);
      this.box(.42, .22, 4.05, -4.75, 3.38, z, p.darkSteel);
    }
    this.sign('NO TRESPASSING', -4.78, 2.25, 13, 2.0, .66, { bg: '#542f27', color: '#b5c1d4', sub: 'AUTHORIZED PERSONNEL ONLY', border: true }, Math.PI / 2);
    this.sign('MERIDIAN', -4.79, 4.05, 3.5, 6.5, .74, { color: '#a6afbd', sub: 'ARCHIVE RECOVERY' }, Math.PI / 2);
    for (const z of [19, 1, -13]) {
      this.cylinder(.07, .07, 8.7, -4.76, 4.35, z, p.rust);
      for (let y = .9; y < 8; y += 1.4) this.box(.28, .1, .18, -4.77, y, z, p.darkSteel);
    }
    for (const z of [10, -9]) {
      this.box(.6, .9, 1.4, -4.67, 3.2, z, p.aluminum);
      for (let y = 2.9; y < 3.58; y += .09) this.box(.04, .034, 1.2, -4.345, y, z, p.darkSteel);
    }
    for (const z of [13, -1, -11]) this.lamp(-4.25, 4.0, z, 0xb5c1d4, 52);
    this.box(.52, .12, .12, -4.5, 4.08, 13, p.darkSteel);

    // Front facade, with a navigable security door at street level.
    this.box(5.4, 7.7, .6, -4.4, 3.85, -16.4, p.paleConcrete, 'wall');
    this.box(7.3, 7.7, .6, 5.45, 3.85, -16.4, p.paleConcrete, 'wall');
    this.box(3.6, 4.3, .6, 0, 5.55, -16.4, p.paleConcrete, 'wall');
    this.box(16.5, .3, .9, 1, 7.85, -16.2, p.steel);
    for (let x = -6.5; x <= 9; x += 1.15) this.box(.04, 3.5, .045, x, 5.8, -16.065, p.steel);
    this.box(12.8, 1.65, .16, .7, 6.1, -15.93, p.darkSteel);
    this.sign('MERIDIAN', .7, 6.25, -15.82, 9.5, 1.22, { bg: '#263331', color: '#d0d6e0', sub: 'HARBOR RECORDS & SURVEY' });
    this.sign('03', 3.02, 2.55, -16.06, 1.35, 1.4, { bg: '#8c9098', color: '#2c3139', width: 256, height: 256 });
    this.sign('RESTRICTED AREA', -3.5, 2.15, -16.06, 2.0, .7, { bg: '#5d78a6', color: '#282c32', sub: '24 HOUR SURVEILLANCE', border: true });
    this.box(4.45, .14, 1.8, 0, 3.7, -15.7, p.darkSteel);
    this.lamp(0, 3.56, -15.1, 0xb5c1d4, 65, 1);
    this.box(.17, 3.55, .22, -1.77, 1.75, -16.0, p.steel);
    this.box(.17, 3.55, .22, 1.77, 1.75, -16.0, p.steel);
    const pivot = new THREE.Group(); pivot.position.set(-1.7, 0, -16.2);
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.36, .16), p.darkSteel); doorMesh.position.set(1.7, 1.68, 0); doorMesh.castShadow = true; pivot.add(doorMesh);
    for (const x of [.08, 1.68, 3.32]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(.05, 3.2, .06), p.steel); bar.position.set(x, 1.7, .12); pivot.add(bar);
    }
    const doorSign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .35), new THREE.MeshPhongMaterial({ map: signTexture('SECURITY', { bg: '#2a2e36', color: '#a6adb8' }), shininess: 7 })); doorSign.position.set(2.42, 2.25, .09); pivot.add(doorSign);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(.06, .32, .1), p.aluminum); handle.position.set(3.05, 1.5, .15); pivot.add(handle);
    this.group.add(pivot);
    const collider: Collider = { box: new THREE.Box3(new THREE.Vector3(-1.7, 0, -16.36), new THREE.Vector3(1.7, 3.36, -16.04)), enabled: true, kind: 'door' };
    this.colliders.push(collider); this.doors.push({ group: pivot, collider, open: false, angle: 0 });

    // Right-hand warehouse and loading docks.
    this.box(12, 10, 42, 16, 5, -7, p.darkConcrete, 'wall');
    this.box(.15, 5.8, 40, 9.9, 6.8, -7, p.containerGreen);
    for (let z = -27; z < 15; z += .7) this.box(.13, 6, .065, 9.78, 6.8, z, p.containerGreen);
    this.box(.65, .25, 43, 9.65, 9.85, -7, p.darkSteel);
    for (const z of [-14, -2, 10]) {
      this.box(.22, 3.5, 5, 9.85, 1.8, z, p.steel);
      for (let y = .3; y < 3.5; y += .16) this.box(.06, .034, 4.8, 9.7, y, z, p.darkSteel);
      this.box(1.2, .35, 6.2, 9.35, .175, z, p.concrete, 'cover');
    }
    this.sign('WAREHOUSE 04', 9.62, 5.7, 1.7, 8, 1, { bg: '#2a2e34', color: '#abb0b9' }, -Math.PI / 2);
    this.lamp(8.8, 5.1, 6, 0xb9d1d1, 65);
    this.lamp(8.8, 5.1, -13, 0xb5c1d4, 48);

    // Utility cables in loose catenary curves.
    for (let j = 0; j < 3; j++) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-5, 8.2 + j * .14, 8), new THREE.Vector3(1.5, 6.6 + j * .14, 3), new THREE.Vector3(10, 9.6 + j * .14, -3)]);
      const geometry = new THREE.TubeGeometry(curve, 28, .018, 5, false);
      this.geometry(geometry, p.darkSteel, 0, 0, 0);
    }
  }

  private container(x: number, z: number, length: number, color: THREE.Material, y = 0) {
    const p = this.palette, w = 2.45, h = 2.6;
    this.box(w, h, length, x, y + h / 2, z, color, 'cover');
    for (let zz = z - length / 2 + .15; zz < z + length / 2; zz += .28) {
      this.box(.045, 2.35, .055, x - w / 2 - .03, y + 1.3, zz, color);
      this.box(.045, 2.35, .055, x + w / 2 + .03, y + 1.3, zz, color);
    }
    for (const xx of [-1, 1]) {
      this.box(.13, 2.65, .13, x + xx * 1.19, y + 1.3, z + length / 2, p.steel);
      this.box(.13, 2.65, .13, x + xx * 1.19, y + 1.3, z - length / 2, p.steel);
      this.box(.1, .12, length, x + xx * 1.2, y + .08, z, p.steel);
      this.box(.1, .12, length, x + xx * 1.2, y + 2.52, z, p.steel);
    }
    for (const xx of [-.87, -.32, .32, .87]) this.cylinder(.025, .025, 2.3, x + xx, y + 1.3, z + length / 2 + .04, p.aluminum);
    this.box(2.25, .035, .025, x, y + 1.05, z + length / 2 + .075, p.aluminum);
    this.sign('HKSU 204 891 6', x, y + 2.1, z + length / 2 + .071, 1.85, .21, { bg: '#393f48', color: '#b2bbc9', width: 768, height: 100 });
    this.sign('M E R I D I A N', x - w / 2 - .058, y + 1.6, z, length * .7, .6, { bg: '#353d4a', color: '#949dab' }, -Math.PI / 2);
    this.sign('CAUTION 9’6” HIGH', x + .45, y + .43, z + length / 2 + .08, 1.15, .29, { bg: '#506c9c', color: '#292d34', width: 512, height: 128 });
  }

  private crate(x: number, z: number, w = 1.3, h = 1.2, d = 1.3, y = 0) {
    const p = this.palette;
    this.box(w, h, d, x, y + h / 2 + .12, z, p.wood, 'wood');
    for (const xx of [-1, 1]) {
      this.box(.11, h + .05, d + .06, x + xx * (w / 2 - .17), y + h / 2 + .12, z, p.darkConcrete);
      this.box(.15, .12, d + .08, x + xx * (w / 2 - .13), y + .06, z, p.wood);
    }
    this.box(w + .04, .12, d + .04, x, y + h + .1, z, p.wood);
    this.box(w + .04, .1, d + .04, x, y + .16, z, p.wood);
    for (let yy = .36; yy < h; yy += .26) this.box(w, .014, .016, x, y + yy, z + d / 2 + .006, p.darkConcrete);
  }

  private barrel(x: number, z: number, material: THREE.Material) {
    const p = this.palette;
    this.cylinder(.31, .31, .9, x, .48, z, material, [0, 0, 0], 20);
    for (const y of [.12, .34, .65, .9]) this.cylinder(.322, .322, .035, x, y, z, p.darkSteel, [0, 0, 0], 20);
    this.colliders.push({ box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, .48, z), new THREE.Vector3(.65, .96, .65)), enabled: true, kind: 'cover' });
  }

  private cone(x: number, z: number) {
    const p = this.palette;
    this.box(.46, .045, .46, x, .025, z, p.rubber);
    this.cylinder(.048, .18, .64, x, .37, z, p.rust);
    this.cylinder(.09, .12, .15, x, .41, z, p.paint);
  }

  private addYard() {
    const p = this.palette;
    this.container(6.7, 2.7, 6.7, p.containerGreen);
    this.container(7.45, -11.5, 6, p.containerRed);
    this.container(13.3, -28, 12, p.containerBlue, 10);
    this.crate(-3.55, -3.7, 1.3, 1.15, 1.8);
    this.crate(-3.7, -5.6, 1.15, 1.6, 1.4);
    this.crate(-3.5, -3.8, 1.0, .78, 1.3, 1.38);
    this.crate(4.45, -.35, 1.1, 1.2, 1.1);
    this.barrel(-4.1, 8.5, p.containerGreen);
    this.barrel(-4.0, 9.25, p.rust);
    this.barrel(8.1, 8.3, p.containerBlue);
    this.cone(-1.7, -13.9); this.cone(2.7, -14.1); this.cone(4.3, 11.9);
    // Bollards protect the loading door.
    for (const x of [-2.0, 2.05]) {
      this.cylinder(.1, .12, 1.0, x, .5, -14.75, p.yellow);
      for (const y of [.25, .6, .95]) this.cylinder(.107, .11, .12, x, y, -14.75, p.darkSteel);
    }
    // Small industrial forklift, parked with the forks down.
    const fx = 4.45, fz = -6.4;
    this.box(1.4, .66, 1.8, fx, .65, fz, p.yellow, 'cover');
    this.box(1.25, .75, .55, fx, 1.25, fz + .66, p.yellow);
    this.box(.66, .13, .63, fx, 1.3, fz + .16, p.rubber);
    this.box(.66, .65, .12, fx, 1.55, fz + .48, p.rubber);
    for (const xx of [-.61, .61]) {
      for (const zz of [-.53, .58]) this.cylinder(.32, .32, .18, fx + xx, .35, fz + zz, p.rubber, [0, 0, Math.PI / 2], 16);
      this.box(.065, 1.85, .08, fx + xx, 1.8, fz + .65, p.darkSteel);
      this.box(.065, 1.85, .08, fx + xx, 1.8, fz - .45, p.darkSteel);
      this.box(.09, 2.6, .16, fx + xx * .66, 1.35, fz - 1.05, p.darkSteel);
      this.box(.13, .06, 1.4, fx + xx * .66, .11, fz - 1.6, p.darkSteel);
    }
    this.box(1.45, .1, 1.45, fx, 2.77, fz, p.darkSteel);
    this.cylinder(.2, .2, .045, fx, 1.47, fz - .35, p.rubber, [Math.PI / 5, 0, 0]);
    this.sign('H-07', fx, 1.3, fz + .95, .75, .33, { bg: '#4a6491', color: '#262a30', width: 256, height: 128 });
    // Chain-link security fence on the near right.
    const chainTexture = canvasTexture(128, 128, ctx => {
      ctx.clearRect(0, 0, 128, 128); ctx.strokeStyle = '#818791'; ctx.lineWidth = 2;
      for (let i = -128; i < 256; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 128, 128); ctx.moveTo(i, 128); ctx.lineTo(i + 128, 0); ctx.stroke(); }
    });
    chainTexture.wrapS = chainTexture.wrapT = THREE.RepeatWrapping; chainTexture.repeat.set(5, 1.5); this.textures.push(chainTexture);
    const fence = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.9), new THREE.MeshPhongMaterial({ map: chainTexture, transparent: true, alphaTest: .3, side: THREE.DoubleSide, shininess: 45, specular: '#697369' }));
    fence.position.set(8.95, 1.48, 16); fence.rotation.y = -Math.PI / 2; this.group.add(fence);
    for (const z of [11, 16, 21]) this.cylinder(.055, .055, 3.2, 8.95, 1.6, z, p.aluminum);
    for (const y of [.15, 2.85]) this.beam(new THREE.Vector3(8.95, y, 11), new THREE.Vector3(8.95, y, 21), .036, p.steel);
    // Road paint and drains break up the reflected pavement.
    for (let z = -12; z < 24; z += 7) {
      this.box(.095, .008, 3.4, 1.25, .008, z, p.yellow);
      this.box(.095, .008, 5.8, 4.6, .008, z, p.paint);
    }
    this.sign('KEEP CLEAR', 0, .018, -12.8, 4.7, 1, { bg: 'transparent', color: '#718ab5' }, 0, -Math.PI / 2);
    for (const z of [13, -2, -12]) {
      this.box(.6, .018, 1.3, -3.9, .018, z, p.darkSteel);
      for (let i = 0; i < 9; i++) this.box(.53, .022, .025, -3.9, .029, z - .54 + i * .135, p.aluminum);
    }
    for (let i = 0; i < 65; i++) {
      const x = this.random() > .5 ? -4.5 + this.random() : 4.7 + this.random() * .7;
      this.box(.05 + this.random() * .2, .008, .04 + this.random() * .23, x, .012, -13 + this.random() * 37, this.random() > .4 ? p.darkConcrete : p.wood, false, this.random() * Math.PI);
    }
    // Curb and the rear limit of the secured insertion area.
    this.box(.34, .17, 55, -4.7, .075, -1, p.concrete);
    this.box(36, 1, 1, 0, .5, 25, p.darkConcrete, 'wall');
  }

  private addInterior() {
    const p = this.palette;
    this.box(.55, 7.5, 21, -7.3, 3.75, -26.9, p.concrete, 'wall');
    this.box(.55, 7.5, 21, 9.2, 3.75, -26.9, p.concrete, 'wall');
    this.box(17, 7.5, .6, 1, 3.75, -37, p.concrete, 'wall');
    this.box(17, .3, 21, 1, 7.3, -26.9, p.darkSteel);
    this.box(17, .08, 21, 1, -.015, -26.8, p.concrete);
    this.box(7.7, 3.5, .27, -3.15, 1.75, -27.6, p.darkConcrete, 'wall');
    this.box(5.5, 3.5, .27, 6.4, 1.75, -27.6, p.darkConcrete, 'wall');
    this.box(3.4, .5, .3, 2, 3.25, -27.6, p.steel, 'wall');
    this.sign('DISPATCH OFFICE', 1.95, 3.24, -27.4, 3.0, .37, { bg: '#242a35', color: '#aeb7c6' });
    for (const z of [-20, -27, -34]) {
      this.box(16, .27, .22, .8, 6.55, z, p.steel);
      this.box(.3, .06, 2.8, 1, 6.15, z, p.light);
      for (const x of [-5.8, 7.6]) this.box(.2, 6.4, .2, x, 3.2, z, p.steel);
    }
    this.lamp(-2.5, 5.1, -21, 0xb5c1d4, 64);
    this.lamp(4.8, 5.1, -31, 0xb9d1d1, 78);
    this.crate(3.6, -20, 2.2, 1.35, 1.5);
    this.crate(-3.8, -19, 2.1, 1.2, 1.7);
    this.crate(.1, -24, 2.0, 1.15, 1.6);
    this.crate(.15, -24, 1.25, .9, 1.3, 1.39);
    this.crate(6.9, -24, 2.4, 1.8, 1.5);
    this.crate(5.8, -34.5, 2.0, 1.2, 1.5);
    // Storage racks, with open aisles.
    for (const x of [-6.1, 7.8]) {
      for (const z of [-22, -25.5]) {
        for (const zz of [-1.45, 1.45]) for (const xx of [-.55, .55]) this.box(.07, 3.6, .07, x + xx, 1.8, z + zz, p.rust);
        for (const y of [.25, 1.3, 2.35, 3.4]) {
          this.box(1.2, .065, 3.1, x, y, z, p.steel);
          if (y < 3) for (let j = 0; j < 3; j++) this.box(.85, .72, .75, x, y + .42, z - 1 + j, p.wood);
        }
      }
    }
    // Evidence table and small lit dispatch station.
    this.box(2.7, .12, 1.15, -4.2, .87, -33.1, p.wood, 'cover');
    for (const x of [-5.35, -3.05]) for (const z of [-33.5, -32.7]) this.box(.07, .8, .07, x, .4, z, p.darkSteel);
    this.box(.73, .52, .1, -5.0, 1.22, -33.36, p.darkSteel);
    this.box(.6, .38, .012, -5, 1.22, -33.296, p.glass);
    this.box(.045, .3, .045, -5, .99, -33.37, p.darkSteel);
    this.box(.5, .025, .18, -5, .95, -32.9, p.rubber);
    const file = new THREE.Mesh(new THREE.BoxGeometry(.4, .045, .52), new THREE.MeshPhongMaterial({ color: '#7991ba', shininess: 3 }));
    this.evidence.add(file); this.evidence.position.copy(this.evidencePosition); this.evidence.rotation.y = -.2;
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(.31, .4), new THREE.MeshPhongMaterial({ map: signTexture('MANIFEST', { bg: '#aeb8c9', color: '#41454d', sub: 'HK / 0742 / 09', width: 256, height: 256 }), shininess: 3 }));
    paper.rotation.x = -Math.PI / 2; paper.position.y = .026; this.evidence.add(paper); this.group.add(this.evidence);
    this.sign('MERIDIAN LOGISTICS', -4.0, 2.4, -36.65, 4.5, .85, { bg: '#414751', color: '#a4adbc', sub: 'DISPATCH & CARGO MANIFESTS' });
    this.box(1.0, 1.55, .7, -6.1, .78, -35.5, p.steel, 'cover');
    for (let i = 0; i < 4; i++) this.box(.3, .034, .03, -6.1, .35 + i * .35, -35.14, p.aluminum);
    this.box(1.2, .028, 1, -3.5, .015, -29.7, p.darkConcrete);
  }

  private addIntelNodes() {
    this.intelPositions.forEach((position, index) => {
      const node = new THREE.Group();
      node.position.copy(position);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.28, .34, .12, 8), this.palette.darkSteel);
      base.position.y = -.62;
      const stem = new THREE.Mesh(new THREE.BoxGeometry(.075, .58, .075), this.palette.aluminum);
      stem.position.y = -.3;
      const screenTexture = signTexture(`PANDA / 0${index + 1}`, { bg: '#132b31', color: '#8fe3d2', sub: 'BEHAVIOR TRACE', width: 256, height: 256 });
      this.textures.push(screenTexture);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(.48, .32, .055), new THREE.MeshPhongMaterial({ color: '#7fcbbb', emissive: '#255e58', emissiveIntensity: .7, map: screenTexture, shininess: 35 }));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.4, .012, 6, 32), new THREE.MeshBasicMaterial({ color: '#80d9c7', transparent: true, opacity: .65 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = -.56;
      node.add(base, stem, screen, ring);
      node.rotation.y = index * 1.7 - .4;
      this.group.add(node); this.intelNodes.push(node);
    });
  }

  private addVehicle() {
    const p = this.palette, x = -3.18, z = 22.0;
    this.box(2.15, 1.2, 4.7, x, 1.06, z, p.darkSteel, 'cover');
    this.box(2.0, 1.0, 2.8, x, 2.0, z + .7, p.darkSteel, 'cover');
    this.box(1.85, .56, 1.35, x, 1.7, z - 1.64, p.steel);
    this.box(1.84, .68, .05, x, 2.03, z - .75, p.glass);
    this.box(1.85, .1, .14, x, 2.4, z - .78, p.darkSteel);
    for (const xx of [-1, 1]) {
      this.box(.04, .67, .9, x + xx * 1.02, 2.05, z - .17, p.glass);
      this.box(.12, 1, .08, x + xx * 1.055, 1.98, z + .37, p.steel);
      this.box(.14, .08, 4.1, x + xx * 1.17, .65, z, p.darkSteel);
      this.box(.18, .08, .43, x + xx * 1.07, 1.6, z + .1, p.aluminum);
      for (const zz of [-1.5, 1.43]) {
        this.cylinder(.57, .57, .36, x + xx * 1.03, .57, z + zz, p.rubber, [0, 0, Math.PI / 2], 24);
        this.cylinder(.28, .28, .39, x + xx * 1.045, .57, z + zz, p.darkSteel, [0, 0, Math.PI / 2], 16);
        this.cylinder(.12, .12, .42, x + xx * 1.06, .57, z + zz, p.aluminum, [0, 0, Math.PI / 2], 12);
      }
    }
    this.box(2.34, .2, .24, x, .83, z - 2.48, p.darkSteel);
    this.box(1.1, .31, .06, x, 1.26, z - 2.38, p.rubber);
    for (const xx of [-.76, .76]) {
      this.box(.42, .24, .045, x + xx, 1.35, z - 2.386, p.coldLight);
      for (const xxx of [-.2, -.1, 0, .1, .2]) this.box(.03, .36, .1, x + xx + xxx, 1.35, z - 2.45, p.darkSteel);
    }
    this.box(1.8, .11, .25, x, 2.59, z + .35, p.darkSteel);
    this.box(.7, .12, .24, x - .43, 2.61, z + .35, p.glass);
    this.box(.7, .12, .24, x + .43, 2.61, z + .35, p.redLight);
    this.cylinder(.017, .017, 1.5, x + .75, 3.18, z + 1.25, p.darkSteel);
    this.sign('MERIDIAN', x + 1.083, 1.46, z + .6, 2.1, .6, { bg: '#272b33', color: '#aeb4bf', sub: 'VEY HARBOR ARCHIVE TEAM' }, Math.PI / 2);
    this.lightSources.push({ position: new THREE.Vector3(x, 1.3, z - 2.6), color: 0xbbc9c6, intensity: 10 });
  }

  private addDistantCity() {
    const p = this.palette;
    for (let i = 0; i < 22; i++) {
      const x = (this.random() - .5) * 145, z = -55 - this.random() * 40;
      const h = 9 + this.random() * 23, w = 4 + this.random() * 8;
      this.box(w, h, 8, x, h / 2, z, p.darkConcrete);
      for (let y = 4; y < h - 1; y += 2.4) for (let xx = -w / 2 + 1; xx < w / 2; xx += 1.7) if (this.random() > .62) this.box(.7, .9, .02, x + xx, y, z + 4.05, this.random() > .4 ? p.window : p.glass);
    }
    // Container gantry crane, visible against the harbor sky.
    const cx = -1, cz = -48;
    for (const x of [-14, 14]) {
      this.beam(new THREE.Vector3(cx + x, 0, cz), new THREE.Vector3(cx + x * .8, 26, cz), .43, p.steel);
      this.beam(new THREE.Vector3(cx + x, 0, cz + 4), new THREE.Vector3(cx + x * .8, 26, cz), .32, p.steel);
    }
    this.box(40, 1.15, 1.8, cx, 26, cz, p.rust);
    this.box(41, .12, 1.9, cx, 27, cz, p.steel);
    for (let x = -20; x < 20; x += 2.5) {
      this.beam(new THREE.Vector3(cx + x, 25.45, cz + .9), new THREE.Vector3(cx + x + 2.5, 26.6, cz + .9), .06, p.darkSteel);
    }
    this.box(3.1, 1.7, 2.5, 4, 25, cz, p.yellow);
    for (const x of [3, 5]) this.cylinder(.025, .025, 13, x, 18, cz, p.darkSteel);
    this.box(6, .4, 1.5, 4, 11.3, cz, p.rust);
    // Rooftop vents and water tanks.
    for (const z of [1, -19]) {
      this.cylinder(.9, 1.05, 1.7, -9, 9.2, z, p.steel, [0, 0, 0], 16);
      this.cylinder(1.13, .95, .3, -9, 10.12, z, p.darkSteel, [0, 0, 0], 16);
      this.box(2.5, .35, 2.5, -9, 8.4, z, p.darkSteel);
    }
    this.cylinder(1.65, 1.65, 3, -12, 13, -24, p.darkSteel, [0, 0, 0], 20);
    for (const x of [-13.1, -10.9]) this.box(.13, 4, .13, x, 10.6, -24, p.steel);
  }

  private addGround() {
    const asphalt = this.palette.asphalt;
    asphalt.map!.repeat.set(23, 30); asphalt.normalMap!.repeat.set(23, 30);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 140), asphalt);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(0, -.052, -15); mesh.receiveShadow = true; this.group.add(mesh);
    const reflector = new Reflector(new THREE.PlaneGeometry(75, 100), { color: '#778985', textureWidth: 640, textureHeight: 360, clipBias: .008 });
    reflector.rotation.x = -Math.PI / 2; reflector.position.set(0, -.033, -10);
    const material = reflector.material as THREE.ShaderMaterial;
    material.transparent = true; material.depthWrite = false;
    material.uniforms.time = { value: 0 };
    material.vertexShader = material.vertexShader.replace('uniform mat4 textureMatrix;', 'uniform mat4 textureMatrix; varying vec2 groundUv;').replace('vUv = textureMatrix * vec4( position, 1.0 );', 'vUv = textureMatrix * vec4( position, 1.0 ); groundUv = uv;');
    material.fragmentShader = material.fragmentShader.replace('uniform vec3 color;', `uniform vec3 color; uniform float time; varying vec2 groundUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}`);
    material.fragmentShader = material.fragmentShader.replace('vec4 base = texture2DProj( tDiffuse, vUv );', `vec4 perturbed=vUv; float n=noise(groundUv*190.); perturbed.x+=(n-.5)*.0006*vUv.w; perturbed.y+=sin(groundUv.y*1300.+time*1.1)*.00016*vUv.w; vec4 base=texture2DProj(tDiffuse,perturbed);`);
    material.fragmentShader = material.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', `float puddle=smoothstep(.31,.66,noise(groundUv*32.)*.7+noise(groundUv*80.)*.3); gl_FragColor=vec4(base.rgb*vec3(.85,.92,.92), .13+puddle*.38);`);
    this.group.add(reflector);
    return reflector;
  }

  private addRain() {
    const n = 2200, positions = new Float32Array(n * 6), offsets = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const x = (this.random() - .5) * 42, y = this.random() * 18, z = -30 + this.random() * 63;
      positions.set([x, y, z, x, y, z], i * 6); offsets[i * 2] = 0; offsets[i * 2 + 1] = .35 + this.random() * .25;
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('offset', new THREE.BufferAttribute(offsets, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 } },
      vertexShader: 'uniform float time; attribute float offset; varying float alpha; void main(){vec3 p=position;p.y=mod(p.y-time*10.,18.)-offset;p.x+=sin(time*.12)*.25+offset*.08; vec4 mv=modelViewMatrix*vec4(p,1.);alpha=clamp(1.+mv.z/70.,.05,.7);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float alpha;void main(){gl_FragColor=vec4(.67,.78,.8,alpha*.13);}',
    });
    const rain = new THREE.LineSegments(geometry, material); rain.frustumCulled = false; this.group.add(rain); return rain;
  }

  update(time: number, dt: number, cameraPosition?: THREE.Vector3) {
    const reference = cameraPosition ?? new THREE.Vector3(.7, 1.7, 20);
    const nearest = [...this.lightSources].sort((a, b) => a.position.distanceToSquared(reference) - b.position.distanceToSquared(reference));
    this.lightPool.forEach((light, i) => { const source = nearest[i]; if (source) { light.position.copy(source.position); light.color.setHex(source.color); light.intensity = source.intensity; } });
    (this.rain.material as THREE.ShaderMaterial).uniforms.time.value = time;
    (this.reflection.material as THREE.ShaderMaterial).uniforms.time.value = time;
    for (const door of this.doors) {
      door.angle = THREE.MathUtils.damp(door.angle, door.open ? -Math.PI * .56 : 0, 5, dt);
      door.group.rotation.y = door.angle;
    }
    if (this.evidence.visible) this.evidence.position.y = 1 + Math.sin(time * 1.8) * .008;
    this.intelNodes.forEach((node, index) => {
      if (!node.visible) return;
      const ring = node.children[3];
      ring.rotation.z = time * .45 + index;
      ring.scale.setScalar(1 + Math.sin(time * 2 + index) * .08);
    });
  }

  setQuality(high: boolean) {
    this.rain.visible = high;
    this.reflection.visible = high;
  }

  reset() {
    this.doors.forEach(d => { d.open = false; d.collider.enabled = true; });
    this.evidence.visible = true;
    this.intelNodes.forEach(node => { node.visible = true; });
  }

  dispose() {
    this.reflection.getRenderTarget().dispose();
    this.textures.forEach(t => t.dispose());
    this.group.traverse(o => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry.dispose();
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        materials.forEach(m => m.dispose());
      }
    });
    Object.values(this.palette).forEach(m => m.dispose());
  }
}
