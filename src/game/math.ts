import * as THREE from 'three';
import type { Collider } from './types';

export function seeded(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function canOccupy(x: number, z: number, colliders: Collider[], radius = .31) {
  if (x < -17 || x > 17 || z < -36 || z > 24) return false;
  return !colliders.some(c => c.enabled && c.box.max.y > .35 && c.box.min.y < 1.55 &&
    x + radius > c.box.min.x && x - radius < c.box.max.x && z + radius > c.box.min.z && z - radius < c.box.max.z);
}

export function moveWithCollision(position: THREE.Vector3, dx: number, dz: number, colliders: Collider[], radius = .31) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / .12));
  for (let i = 0; i < steps; i++) {
    if (canOccupy(position.x + dx / steps, position.z, colliders, radius)) position.x += dx / steps;
    if (canOccupy(position.x, position.z + dz / steps, colliders, radius)) position.z += dz / steps;
  }
}

const ray = new THREE.Ray();
const direction = new THREE.Vector3();
const point = new THREE.Vector3();
export function visibleBetween(from: THREE.Vector3, to: THREE.Vector3, colliders: Collider[]) {
  direction.subVectors(to, from);
  const distance = direction.length();
  direction.normalize(); ray.set(from, direction);
  return !colliders.some(c => c.enabled && ray.intersectBox(c.box, point) && from.distanceTo(point) < distance - .35);
}

export function findPath(start: THREE.Vector3, goal: THREE.Vector3, colliders: Collider[]): THREE.Vector3[] {
  const sx = Math.round(start.x), sz = Math.round(start.z), gx = Math.round(goal.x), gz = Math.round(goal.z);
  if (Math.abs(sx - gx) + Math.abs(sz - gz) < 2) return [goal.clone()];
  const key = (x: number, z: number) => `${x},${z}`;
  type Node = { x: number; z: number; g: number; f: number; parent: Node | null };
  const open: Node[] = [{ x: sx, z: sz, g: 0, f: 0, parent: null }];
  const visited = new Map<string, number>();
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let iteration = 0; open.length && iteration < 950; iteration++) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift()!;
    if (Math.abs(current.x - gx) <= 1 && Math.abs(current.z - gz) <= 1) {
      const path: THREE.Vector3[] = [];
      let n: Node | null = current;
      while (n?.parent) { path.push(new THREE.Vector3(n.x, 0, n.z)); n = n.parent; }
      return path.reverse();
    }
    for (const [dx, dz] of dirs) {
      const nx = current.x + dx, nz = current.z + dz;
      if (!canOccupy(nx, nz, colliders, .36)) continue;
      if (dx && dz && (!canOccupy(current.x + dx, current.z, colliders, .36) || !canOccupy(current.x, current.z + dz, colliders, .36))) continue;
      const g = current.g + (dx && dz ? 1.414 : 1), k = key(nx, nz);
      if ((visited.get(k) ?? Infinity) <= g) continue;
      visited.set(k, g);
      open.push({ x: nx, z: nz, g, f: g + Math.hypot(nx - gx, nz - gz), parent: current });
    }
  }
  return [];
}

export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}
