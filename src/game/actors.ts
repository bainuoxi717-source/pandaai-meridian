import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { signTexture, surfaceTexture } from './materials';
import { WeaponModel } from './weapon';

export type ActorKind = 'ally' | 'suspect' | 'civilian';
export type ActorState = 'active' | 'surrendered' | 'secured' | 'down';

export class Actor {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly spawn: THREE.Vector3;
  readonly gun: WeaponModel | null;
  readonly head = new THREE.Group();
  readonly leftArm = new THREE.Group();
  readonly rightArm = new THREE.Group();
  readonly leftLeg = new THREE.Group();
  readonly rightLeg = new THREE.Group();
  health = 100;
  state: ActorState = 'active';
  morale = 100;
  moving = false;
  shootTimer = 0;
  stunned = 0;
  alerted = false;
  path: THREE.Vector3[] = [];
  pathTimer = 0;
  flashTimer = 0;
  shouts = 0;
  visibleToPlayer = false;
  mixer: THREE.AnimationMixer | null = null;
  private materials: THREE.Material[] = [];
  private textures: THREE.Texture[] = [];
  private footPhase = 0;
  private disposed = false;

  constructor(readonly id: string, readonly kind: ActorKind, x: number, z: number, readonly index: number) {
    this.spawn = new THREE.Vector3(x, 0, z);
    this.group.position.copy(this.spawn); this.group.add(this.body);
    this.group.rotation.y = kind === 'ally' ? Math.PI + (index % 2 ? .1 : -.15) : 0;
    const fabricTex = surfaceTexture('#656a73', 'fabric'); this.textures.push(fabricTex);
    const shirtColors = kind === 'ally' ? ['#344d65', '#41506b', '#624c44', '#35465b'] : kind === 'suspect' ? ['#474d57', '#374153', '#393e47', '#503d37'] : ['#848581', '#637271'];
    const cloth = new THREE.MeshPhongMaterial({ color: shirtColors[index % shirtColors.length], map: fabricTex, shininess: 3 });
    const pants = new THREE.MeshPhongMaterial({ color: kind === 'civilian' ? '#303e44' : '#34383f', map: fabricTex, shininess: 3 });
    const black = new THREE.MeshPhongMaterial({ color: '#20242a', shininess: 12, map: fabricTex });
    const armor = new THREE.MeshPhongMaterial({ color: '#667685', shininess: 7, map: fabricTex });
    const skin = new THREE.MeshPhongMaterial({ color: ['#7283a0', '#8598b8', '#51617d', '#7186aa'][index % 4], shininess: 9, specular: '#212429' });
    const helmet = new THREE.MeshPhongMaterial({ color: '#b2714e', shininess: 17, map: fabricTex });
    const metal = new THREE.MeshPhongMaterial({ color: '#6782b1', shininess: 47 });
    this.materials.push(cloth, pants, black, armor, skin, helmet, metal);

    this.addBody(cloth, pants, black, skin, helmet);

    if (kind !== 'civilian') {
      this.gun = new WeaponModel(false, index === 1 ? 'quietline' : 'stillwater');
      this.gun.group.scale.setScalar(.82); this.gun.group.position.set(.14, 1.25, .35); this.gun.group.rotation.y = Math.PI;
      this.body.add(this.gun.group);
      // Separate armor geometry gives the squad its recognizable silhouette.
      if (kind === 'ally') {
        this.mesh(new RoundedBoxGeometry(.48, .46, .3, 2, .055), armor, 0, 1.27, 0);
        this.mesh(new RoundedBoxGeometry(.34, .43, .16, 2, .04), black, 0, 1.27, -.235);
        for (const x of [-.145, 0, .145]) {
          this.mesh(new RoundedBoxGeometry(.125, .18, .086, 2, .015), black, x, 1.18, .18);
          this.mesh(new THREE.BoxGeometry(.11, .013, .014), metal, x, 1.22, .225);
        }
        for (const y of [1.03, 1.11, 1.2]) this.mesh(new THREE.BoxGeometry(.46, .018, .022), black, 0, y, -.324);
        this.mesh(new RoundedBoxGeometry(.13, .18, .095, 2, .018), armor, -.285, 1.16, -.03);
        this.mesh(new RoundedBoxGeometry(.11, .19, .078, 2, .015), black, .2, 1.43, -.12);
        this.mesh(new THREE.CylinderGeometry(.008, .008, .37, 6), metal, .2, 1.7, -.12);
        for (const side of [-1,1]) {
          this.mesh(new THREE.CylinderGeometry(.065,.065,.33,12),metal,side*.2,1.26,-.33);
          this.mesh(new RoundedBoxGeometry(.085,.075,.04,2,.01),skin,side*.2,1.47,-.355);
        }
        const label = signTexture('MERIDIAN', { bg: '#2a2e34', color: '#b8c0cd', sub: 'ARCHIVE TEAM', width: 512, height: 256 }); this.textures.push(label);
        const patch = this.mesh(new THREE.PlaneGeometry(.3, .145), new THREE.MeshPhongMaterial({ map: label, shininess: 3 }), 0, 1.425, -.322); patch.rotation.y = Math.PI;
        const front = this.mesh(new THREE.PlaneGeometry(.2, .093), new THREE.MeshPhongMaterial({ map: label, shininess: 3 }), 0, 1.425, .154);
        front.name = 'surveyor-patch';
        const nameTag = signTexture(id, { bg: '#383e49', color: '#a4b2c9', width: 128, height: 128 }); this.textures.push(nameTag);
        const armTag = this.mesh(new THREE.PlaneGeometry(.09, .08), new THREE.MeshPhongMaterial({ map: nameTag, shininess: 3 }), -.31, 1.38, -.02); armTag.rotation.y = -Math.PI / 2;
      } else {
        this.mesh(new RoundedBoxGeometry(.43,.35,.14,2,.04),black,0,1.22,.15);
        for(let n=0;n<3;n++)this.mesh(new THREE.BoxGeometry(.38,.015,.02),metal,0,1.12+n*.1,.232);
      }
    } else this.gun = null;

    this.group.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; o.userData.actorId = id; } });
    this.batchStaticBody();
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, scale: [number, number, number] = [1, 1, 1], parent: THREE.Group = this.body) {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.scale.set(...scale); parent.add(mesh); return mesh;
  }

  private segment(from: THREE.Vector3, to: THREE.Vector3, r: number, material: THREE.Material, parent: THREE.Group) {
    const delta = to.clone().sub(from);
    const m = this.mesh(new THREE.CapsuleGeometry(r, Math.max(.01, delta.length() - r * 1.3), 5, 12), material, 0, 0, 0, [1, 1, 1], parent);
    m.position.copy(from).add(to).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return m;
  }

  private addBody(cloth: THREE.Material, pants: THREE.Material, black: THREE.Material, skin: THREE.Material, helmet: THREE.Material) {
    this.mesh(new THREE.CapsuleGeometry(.2, .28, 6, 16), cloth, 0, 1.23, 0, [1.16, 1, .73]);
    this.mesh(new RoundedBoxGeometry(.37, .2, .25, 2, .06), pants, 0, .91, 0);
    this.mesh(new THREE.CylinderGeometry(.071, .08, .14, 12), skin, 0, 1.52, 0);
    this.head.position.set(0, 1.665, 0); this.body.add(this.head);
    this.mesh(new THREE.SphereGeometry(.225,24,16),helmet,0,.01,0,[1.15,1,.98],this.head);
    this.mesh(new THREE.SphereGeometry(.218,24,16,Math.PI*.1,Math.PI*.8,.45,1.8),black,0,.01,.015,[1.15,1,1.02],this.head);
    for(const side of [-1,1]){
      const ring=this.mesh(new THREE.TorusGeometry(.085,.021,8,18),helmet,side*.255,.005,0,[1,1,1],this.head);ring.rotation.y=Math.PI/2;
      this.mesh(new RoundedBoxGeometry(.045,.16,.1,2,.014),skin,side*.105,-.02,.203,[1,1,1],this.head);
    }
    this.mesh(new THREE.TorusGeometry(.225,.045,8,24),helmet,0,-.18,0,[1,1,1],this.head).rotation.x=Math.PI/2;
    for (const [side, group] of [[-1, this.leftLeg], [1, this.rightLeg]] as const) {
      group.position.set(side * .12, .9, 0); this.body.add(group);
      this.segment(new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * .025, -.4, .025), .106, pants, group);
      this.segment(new THREE.Vector3(side * .025, -.4, .025), new THREE.Vector3(side * .04, -.77, -.02), .077, pants, group);
      this.mesh(new RoundedBoxGeometry(.17, .15, .31, 2, .045), black, side * .04, -.8, .07, [1, 1, 1], group);
      if (this.kind !== 'civilian') this.mesh(new RoundedBoxGeometry(.12, .13, .036, 2, .023), helmet, side * .025, -.4, .115, [1, 1, 1], group);
    }
    for (const [side, group] of [[-1, this.leftArm], [1, this.rightArm]] as const) {
      group.position.set(side * .225, 1.395, 0); this.body.add(group);
      if (this.kind === 'civilian') {
        this.segment(new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * .19, .12, .02), .075, cloth, group);
        this.segment(new THREE.Vector3(side * .19, .12, .02), new THREE.Vector3(side * .19, .43, .01), .049, skin, group);
        this.mesh(new THREE.SphereGeometry(.055, 12, 8), skin, side * .19, .49, .01, [.85, 1.36, .5], group);
      } else {
        const elbow = new THREE.Vector3(side * .065, -.215, .11), hand = new THREE.Vector3(side < 0 ? .17 : -.08, -.18, side < 0 ? .58 : .28);
        this.segment(new THREE.Vector3(0, 0, 0), elbow, .085, cloth, group);
        this.segment(elbow, hand, .067, cloth, group);
        this.mesh(new THREE.SphereGeometry(.065, 12, 10), black, hand.x, hand.y, hand.z, [.8, .8, 1.1], group);
      }
    }
  }

  private batchStaticBody() {
    const groups = [this.body, this.leftLeg, this.rightLeg, this.head, this.leftArm, this.rightArm];
    for (const group of groups) {
      const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
      for (const child of [...group.children]) {
        if (!(child instanceof THREE.Mesh) || child instanceof THREE.SkinnedMesh || Array.isArray(child.material) || child.material.transparent) continue;
        child.updateMatrix();
        const geo = (child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()).applyMatrix4(child.matrix);
        if (!batches.has(child.material)) batches.set(child.material, []);
        batches.get(child.material)!.push(geo); group.remove(child); child.geometry.dispose();
      }
      batches.forEach((geos, mat) => {
        const merged = mergeGeometries(geos, false);
        if (merged) { const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.actorId = this.id; group.add(mesh); }
        geos.forEach(g => g.dispose());
      });
    }
  }

  update(dt: number, time: number) {
    this.shootTimer = Math.max(0, this.shootTimer - dt);
    this.stunned = Math.max(0, this.stunned - dt);
    this.flashTimer = Math.max(0, this.flashTimer - dt);
    if (this.gun) { this.gun.group.visible = this.state === 'active'; this.gun.flash.visible = this.flashTimer > 0; }
    this.body.rotation.z = THREE.MathUtils.damp(this.body.rotation.z, this.state === 'down' ? 1.48 : 0, 7, dt);
    this.body.position.y = THREE.MathUtils.damp(this.body.position.y, this.state === 'down' ? .03 : this.state === 'secured' ? -.48 : 0, 6, dt);
    if (this.state === 'down') return;
    {
      this.footPhase += dt * (this.moving ? 6 : 0);
      const step = this.moving ? Math.sin(this.footPhase) * .39 : 0;
      this.leftLeg.rotation.x = THREE.MathUtils.damp(this.leftLeg.rotation.x, step, 9, dt);
      this.rightLeg.rotation.x = THREE.MathUtils.damp(this.rightLeg.rotation.x, -step, 9, dt);
      this.head.rotation.y = Math.sin(time * .52 + this.index) * .055;
      if (this.state === 'surrendered') {
        this.leftArm.rotation.z = THREE.MathUtils.damp(this.leftArm.rotation.z, -1.9, 4, dt);
        this.rightArm.rotation.z = THREE.MathUtils.damp(this.rightArm.rotation.z, 1.9, 4, dt);
      } else if (this.kind === 'civilian' && this.state === 'secured') {
        this.leftArm.rotation.z = THREE.MathUtils.damp(this.leftArm.rotation.z, 1.4, 4, dt);
        this.rightArm.rotation.z = THREE.MathUtils.damp(this.rightArm.rotation.z, -1.4, 4, dt);
      }
    }
  }

  reset() {
    this.group.position.copy(this.spawn); this.group.rotation.y = this.kind === 'ally' ? Math.PI : 0;
    this.health = 100; this.state = 'active'; this.morale = 100; this.alerted = false; this.stunned = 0; this.shouts = 0;
    this.path = []; this.pathTimer = 0; this.shootTimer = 0; this.moving = false; this.flashTimer = 0;
    this.leftArm.rotation.z = this.rightArm.rotation.z = 0;
  }

  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.mixer?.stopAllAction(); this.gun?.dispose();
    this.materials.forEach(m => m.dispose()); this.textures.forEach(t => t.dispose());
    this.group.traverse(o => { if (o instanceof THREE.Mesh && !(o instanceof THREE.SkinnedMesh)) o.geometry.dispose(); });
  }
}
