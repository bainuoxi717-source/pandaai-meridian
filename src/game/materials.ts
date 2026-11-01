import * as THREE from 'three';
import { seeded } from './math';

export function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function surfaceTexture(base: string, type: 'metal' | 'concrete' | 'fabric' | 'asphalt' = 'metal') {
  const random = seeded(1985 + type.length);
  const texture = canvasTexture(512, 512, ctx => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 38000; i++) {
      const value = random() > .5 ? 225 : 15;
      ctx.fillStyle = `rgba(${value},${value},${value},${random() * (type === 'asphalt' ? .28 : .12)})`;
      const x = random() * 512, y = random() * 512;
      ctx.fillRect(x, y, type === 'metal' ? .8 : 1.5, type === 'metal' ? random() * 14 + 1 : 1.5);
    }
    if (type === 'concrete' || type === 'metal') {
      for (let i = 0; i < 85; i++) {
        const x = random() * 512;
        const gradient = ctx.createLinearGradient(x, 0, x, 512);
        gradient.addColorStop(0, 'rgba(16,19,14,0)'); gradient.addColorStop(.2, `rgba(16,19,14,${random() * .15})`); gradient.addColorStop(1, 'rgba(16,19,14,0)');
        ctx.fillStyle = gradient; ctx.fillRect(x, 0, random() * 4, 512);
      }
    }
    if (type === 'fabric') {
      ctx.strokeStyle = 'rgba(18,22,16,.15)'; ctx.lineWidth = 1;
      for (let i = 0; i < 512; i += 3) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke(); }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function glowTexture() {
  return canvasTexture(128, 128, ctx => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(.1, 'rgba(255,215,160,.8)'); g.addColorStop(.24, 'rgba(255,195,135,.21)'); g.addColorStop(1, 'rgba(255,180,110,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  });
}

export function signTexture(text: string, options: { bg?: string; color?: string; sub?: string; width?: number; height?: number; border?: boolean } = {}) {
  const w = options.width ?? 1024, h = options.height ?? 256;
  return canvasTexture(w, h, ctx => {
    ctx.fillStyle = options.bg ?? '#202328'; ctx.fillRect(0, 0, w, h);
    if (options.border) { ctx.strokeStyle = options.color ?? '#cfd4dd'; ctx.lineWidth = 6; ctx.strokeRect(12, 12, w - 24, h - 24); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = options.color ?? '#c8ced7'; ctx.font = `700 ${h * (options.sub ? .43 : .53)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    ctx.fillText(text, w / 2, h * (options.sub ? .42 : .52), w - 40);
    if (options.sub) { ctx.font = `500 ${h * .15}px monospace`; ctx.fillText(options.sub, w / 2, h * .78, w - 60); }
    const random = seeded(101);
    for (let i = 0; i < 700; i++) { ctx.fillStyle = `rgba(15,20,18,${random() * .17})`; ctx.fillRect(random() * w, random() * h, random() * 30, random() * 3); }
  });
}

export function makePalette() {
  const textures: THREE.Texture[] = [];
  const load = (_name: string, fallback: THREE.Texture, colorSpace = true) => {
    textures.push(fallback);
    fallback.colorSpace = colorSpace ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return fallback;
  };
  const asphalt = load('asphalt.jpg', surfaceTexture('#444847', 'asphalt'));
  const brick = load('brick.jpg', surfaceTexture('#596270', 'concrete'));
  const concrete = load('concrete.jpg', surfaceTexture('#898b80', 'concrete'));
  const metal = surfaceTexture('#717a75'); textures.push(metal);
  const fabric = surfaceTexture('#585f6a', 'fabric'); textures.push(fabric);
  const normal = load('asphalt-normal.jpg', canvasTexture(4, 4, ctx => { ctx.fillStyle = '#8080ff'; ctx.fillRect(0, 0, 4, 4); }), false);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  const standard = (color: THREE.ColorRepresentation, roughness = .7, metalness = .1, map?: THREE.Texture) => new THREE.MeshPhongMaterial({ color, shininess: Math.max(2, (1 - roughness) * 105), specular: new THREE.Color().setScalar(.08 + metalness * .3), ...(map ? { map } : {}) });
  const materials = {
    asphalt: new THREE.MeshPhongMaterial({ color: '#697676', map: asphalt, normalMap: normal, normalScale: new THREE.Vector2(.55, .55), shininess: 85, specular: '#506362' }),
    brick: standard('#838c9a', .91, 0, brick),
    concrete: standard('#9ca1aa', .86, .02, concrete),
    paleConcrete: standard('#a7acb4', .83, .03, concrete),
    darkConcrete: standard('#41454c', .92, 0, concrete),
    steel: standard('#404c4a', .4, .7, metal),
    darkSteel: standard('#202a29', .4, .75, metal),
    aluminum: standard('#90978f', .29, .8, metal),
    rust: standard('#795143', .79, .36, metal),
    containerGreen: standard('#3b4350', .65, .65, metal),
    containerRed: standard('#75483a', .67, .54, metal),
    containerBlue: standard('#3f535a', .65, .55, metal),
    yellow: standard('#4f6b9a', .7, .35, metal),
    paint: standard('#a1abbb', .83, 0),
    rubber: standard('#202625', .92, .03),
    wood: standard('#505b6e', .94, 0, concrete),
    glass: new THREE.MeshPhongMaterial({ color: '#234144', shininess: 110, specular: '#919cae' }),
    light: new THREE.MeshBasicMaterial({ color: '#ccd4e1' }),
    coldLight: new THREE.MeshBasicMaterial({ color: '#b5d8d5' }),
    window: new THREE.MeshPhongMaterial({ color: '#6980a6', shininess: 35, emissive: '#8096bd', emissiveIntensity: .35 }),
    redLight: new THREE.MeshBasicMaterial({ color: '#bd4c39' }),
    fabric: standard('#474d57', .96, 0, fabric),
    darkFabric: standard('#2d3036', .98, 0, fabric),
    skin: standard('#7084a5', .95, 0),
  };
  return { materials, textures };
}

export type Palette = ReturnType<typeof makePalette>['materials'];
