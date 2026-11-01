import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvasTexture, surfaceTexture, signTexture } from './materials';
import type { WeaponId } from './types';

export class WeaponModel {
  readonly group = new THREE.Group();
  readonly magazine = new THREE.Group();
  readonly muzzle = new THREE.Group();
  readonly flash: THREE.Mesh;
  private batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];

  constructor(viewModel = true, readonly id: WeaponId = 'stillwater') {
    const createMaterial = (parameters: THREE.MeshStandardMaterialParameters) => viewModel
      ? new THREE.MeshStandardMaterial(parameters)
      : new THREE.MeshPhongMaterial({ color: parameters.color, map: parameters.map ?? null, shininess: (1 - (parameters.roughness ?? .7)) * 80, specular: '#474b53' });
    const metalTex = surfaceTexture('#75807c', 'metal');
    const fabricTex = surfaceTexture('#555d6b', 'fabric');
    this.textures.push(metalTex, fabricTex);
    const metal = createMaterial({ color: '#303a38', metalness: .86, roughness: .38, map: metalTex });
    const polymer = createMaterial({ color: '#202327', metalness: .14, roughness: .75, map: metalTex });
    const rubber = createMaterial({ color: '#111a19', roughness: .95, map: fabricTex });
    const silver = createMaterial({ color: '#7d8580', metalness: .88, roughness: .35 });
    const bronze = createMaterial({ color: '#464a51', metalness: .85, roughness: .48, map: metalTex });
    const fabric = createMaterial({ color: '#4a515c', roughness: .98, map: fabricTex });
    this.materials.push(metal, polymer, rubber, silver, bronze, fabric);

    const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, rx = 0, ry = 0, rz = 0) => this.part(Math.min(w, h, d) < .02 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * .12), mat, x, y, z, rx, ry, rz);
    const cyl = (r: number, length: number, x: number, y: number, z: number, mat: THREE.Material, segments = 16) => this.part(new THREE.CylinderGeometry(r, r, length, segments), mat, x, y, z, Math.PI / 2);

    // Receiver, machined upper rail, stock and suppressor.
    box(.111, .108, .28, 0, .005, -.045, metal);
    box(.104, .068, .18, 0, -.062, .035, polymer);
    box(.116, .098, .32, 0, .013, -.34, id === 'beanbag' ? bronze : metal);
    box(.075, .031, .32, 0, .074, -.345, polymer);
    for (let i = 0; i < 23; i++) box(.106, .011, .012, 0, .083, -.492 + i * .025, metal);
    for (const x of [-1, 1]) {
      box(.012, .053, .27, x * .062, -.006, -.355, bronze);
      for (let i = 0; i < 7; i++) {
        box(.014, .018, .023, x * .069, .013, -.458 + i * .036, rubber);
        box(.014, .008, .023, x * .069, -.022, -.458 + i * .036, rubber);
      }
      for (const z of [-.485, -.21, -.13, .069]) cyl(.009, .011, x * .066, .009, z, silver, 8);
    }
    cyl(.021, .22, 0, .028, -.593, bronze);
    cyl(.041, id === 'quietline' ? .12 : .19, 0, .028, -.735, metal, 24);
    for (const z of [-.653, -.79]) cyl(.043, .015, 0, .028, z, polymer, 24);
    cyl(.026, .005, 0, .028, -.835, rubber, 24);
    cyl(.035, .21, 0, -.005, .189, metal);
    box(.073, .115, .2, 0, -.032, .286, polymer);
    box(.092, .046, .16, 0, .043, .29, polymer);
    box(.112, .21, .038, 0, -.042, .384, rubber);
    box(.052, .065, .05, 0, -.069, .16, metal);
    box(.075, .183, .063, 0, -.164, .116, rubber, -.29);
    for (let i = 0; i < 5; i++) box(.08, .014, .01, 0, -.109 - i * .028, .15 + i * .008, polymer);
    // Magazine is a separate piece for the reload animation.
    const mag = new THREE.Mesh(new RoundedBoxGeometry(.073, .214, .104, 2, .012), id === 'beanbag' ? bronze : metal);
    mag.position.set(0, -.195, -.025); mag.rotation.x = -.13; this.magazine.add(mag);
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(.076, .012, .087), polymer); rib.position.set(0, -.13 - i * .042, -.032 + i * .005); this.magazine.add(rib);
    }
    this.group.add(this.magazine);
    // Trigger, controls, ejector port, and identifying markings.
    this.part(new THREE.TorusGeometry(.044, .008, 6, 12, Math.PI * 1.8), metal, 0, -.119, .061, 0, Math.PI / 2);
    box(.009, .038, .012, 0, -.104, .075, silver, -.3);
    box(.005, .035, .082, .058, -.003, -.047, rubber);
    box(.008, .008, .06, .065, -.02, -.047, silver);
    box(.02, .021, .045, -.064, -.042, .05, polymer);
    box(.015, .014, .026, -.064, .036, .07, silver);
    const marking = signTexture(id === 'stillwater' ? 'SIG  STILLWATER' : id === 'quietline' ? 'HK  QUIETLINE' : 'LESS LETHAL', { bg: '#272b31', color: '#899087', width: 512, height: 128 });
    this.textures.push(marking);
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(.1, .024), new THREE.MeshPhongMaterial({ map: marking, shininess: 8 }));
    mark.position.set(.057, -.05, .005); mark.rotation.y = Math.PI / 2; this.group.add(mark);
    // Holographic optic, with an actual transparent lens.
    box(.13, .026, .125, 0, .107, -.013, polymer);
    box(.12, .012, .04, 0, .131, -.032, metal);
    for (const x of [-.058, .058]) box(.019, .108, .044, x, .186, -.032, metal);
    box(.128, .02, .046, 0, .235, -.032, metal);
    box(.124, .015, .04, 0, .14, -.032, metal);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(.098, .082), new THREE.MeshBasicMaterial({ color: '#779d9b', transparent: true, opacity: .15, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.set(0, .187, -.041); this.group.add(glass);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: '#738cb7', transparent: true, opacity: .85, depthTest: false });
    const reticle = new THREE.Mesh(new THREE.TorusGeometry(.0105, .0008, 6, 24), dotMaterial); reticle.position.set(0, .186, -.036); this.group.add(reticle);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(.0015, 8), dotMaterial); dot.position.set(0, .186, -.034); this.group.add(dot);
    // Side-mounted illuminator and cable.
    cyl(.026, .147, .082, -.011, -.403, polymer);
    cyl(.021, .008, .082, -.011, -.482, silver);
    box(.041, .027, .09, -.009, -.062, -.37, rubber);
    box(.038, .107, .047, 0, -.098, -.335, rubber, .12);

    if (id === 'beanbag') {
      box(.121, .075, .19, 0, -.018, -.31, bronze);
      for (let i = 0; i < 6; i++) box(.126, .008, .01, 0, -.05, -.385 + i * .028, polymer);
    }

    if (viewModel) {
      this.sleeve(new THREE.Vector3(.085, -.19, .14), new THREE.Vector3(.24, -.43, .48), .09, fabric);
      this.sleeve(new THREE.Vector3(-.075, -.08, -.34), new THREE.Vector3(-.32, -.4, .35), .085, fabric);
      // Gloves with armored knuckle pads and curved finger segments.
      this.part(new THREE.SphereGeometry(.074, 14, 10), rubber, .052, -.142, .101, 0, 0, 0, [1, .66, .95]);
      this.part(new THREE.SphereGeometry(.073, 14, 10), rubber, -.057, -.073, -.352, 0, 0, 0, [.8, .7, 1.23]);
      for (let i = 0; i < 4; i++) {
        box(.031, .021, .025, -.104, -.06, -.395 + i * .026, polymer, 0, 0, .2);
        this.part(new THREE.CapsuleGeometry(.015, .038, 4, 8), rubber, .079, -.106 - i * .023, .07, Math.PI / 2, 0, .45);
        box(.022, .018, .024, .072, -.095 - i * .025, .121, polymer);
      }
      box(.12, .018, .1, -.14, -.17, -.145, polymer, -.35, 0, -.25);
    }
    this.flush();
    this.muzzle.position.set(0, .028, -.846); this.group.add(this.muzzle);
    const texture = canvasTexture(128, 128, ctx => {
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(.13, 'rgba(255,223,133,1)'); g.addColorStop(.4, 'rgba(255,161,45,.7)'); g.addColorStop(1, 'rgba(255,117,20,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    });
    this.textures.push(texture);
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(.33, .33), new THREE.MeshBasicMaterial({ map: texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.flash.visible = false; this.muzzle.add(this.flash);
    if (viewModel) this.group.scale.setScalar(.88);
    this.group.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = false; o.receiveShadow = true; } });
  }

  private part(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, scale: [number, number, number] = [1, 1, 1]) {
    if (geo.index) { const flat = geo.toNonIndexed(); geo.dispose(); geo = flat; }
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(...scale)));
    if (!this.batches.has(mat)) this.batches.set(mat, []);
    this.batches.get(mat)!.push(geo);
  }

  private sleeve(from: THREE.Vector3, to: THREE.Vector3, r: number, mat: THREE.Material) {
    const dir = to.clone().sub(from);
    const geo = new THREE.CylinderGeometry(r * .77, r * 1.2, dir.length(), 14, 4);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    const mid = from.clone().add(to).multiplyScalar(.5);
    this.part(geo, mat, mid.x, mid.y, mid.z);
  }

  private flush() {
    this.batches.forEach((geos, mat) => {
      const geo = mergeGeometries(geos, false);
      if (geo) this.group.add(new THREE.Mesh(geo, mat));
      geos.forEach(g => g.dispose());
    });
    this.batches.clear();
  }

  dispose() {
    this.group.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } });
    this.textures.forEach(t => t.dispose()); this.materials.forEach(m => m.dispose());
  }
}
