import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TacticalWorld } from './world';
import { Actor } from './actors';
import { WeaponModel } from './weapon';
import { TacticalAudio } from './audio';
import { canOccupy, findPath, moveWithCollision, seeded, visibleBetween } from './math';
import { DEFAULT_SETTINGS, initialSnapshot, SQUAD_ROSTER, WEAPONS } from './types';
import type { GameActions, GameSnapshot, Marker, Menu, Order, Protocol, Settings, WeaponId } from './types';

interface Interaction { type: 'door' | 'arrest' | 'civilian' | 'evidence' | 'intel' | 'extract'; label: string; actor?: Actor; index?: number; }
interface Transient { object: THREE.Object3D; time: number; maxTime: number; }

const VEC_UP = new THREE.Vector3(0, 1, 0);

export class GameEngine implements GameActions {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(67, 1, .065, 190);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly post: ShaderPass;
  private readonly antialias: ShaderPass;
  private readonly viewScene = new THREE.Scene();
  private readonly viewCamera = new THREE.PerspectiveCamera(62, 1, .01, 10);
  private readonly audio = new TacticalAudio();
  private readonly world: TacticalWorld;
  private readonly clock = new THREE.Clock();
  private readonly player = new THREE.Vector3(.7, 1.7, 20);
  private readonly random = seeded(713);
  private marketRandom = seeded(20261101);
  private marketTickTimer = 0;
  private readonly keys = new Set<string>();
  private readonly actors: Actor[] = [];
  private readonly allies: Actor[] = [];
  private readonly suspects: Actor[] = [];
  private readonly civilians: Actor[] = [];
  private readonly transients: Transient[] = [];
  private readonly flashlight: THREE.SpotLight;
  private readonly effectLight = new THREE.PointLight('#dfe4ed', 0, 24, 1.8);
  private readonly resizeObserver: ResizeObserver;
  private weaponModel: WeaponModel;
  private settings: Settings;
  private state: GameSnapshot = initialSnapshot();
  private yaw = .025;
  private pitch = -.008;
  private recoil = 0;
  private recoilRoll = 0;
  private fireTimer = 0;
  private reloadTimer = 0;
  private stepTimer = 0;
  private shoutTimer = 0;
  private firing = false;
  private dragging = false;
  private disposed = false;
  private frame = 0;
  private emitTimer = 0;
  private radioId = 1;
  private hadLock = false;
  private fallInTrail: THREE.Vector3[] = [];
  private showExtractionNotified = false;
  private environment: THREE.WebGLRenderTarget;
  private totalTime = 0;
  private lastFrameTime = 0;
  private smoothFrameTime = 1 / 60;
  private fallbackReported = false;
  private prepared = false;
  private renderedFrames = 0;
  private renderScale = 1;
  private lastResolutionChange = 0;
  private interfaceOpen = false;
  private renderDirty = true;
  private lastContactTime = -999;
  private lastDamageTime = -999;
  private lastScanTime = -999;

  constructor(
    private readonly container: HTMLElement,
    private readonly onSnapshot: (state: GameSnapshot) => void,
    private readonly onMenu: (menu: Menu) => void,
    settings: Settings = DEFAULT_SETTINGS,
  ) {
    this.settings = { ...settings };
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = .92;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.domElement.setAttribute('aria-label', 'PandaAI 寂静子午线雨夜港口三维战术场景');
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.className = 'world-canvas';
    container.appendChild(this.renderer.domElement);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, .04, .1, 100, { size: 64 });
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = .55;
    room.dispose(); pmrem.dispose();
    this.world = new TacticalWorld(this.scene);
    const renderReflection = this.world.reflection.onBeforeRender.bind(this.world.reflection);
    this.world.reflection.onBeforeRender = (...args) => { if (this.renderedFrames % 2 === 0) renderReflection(...args); };
    this.camera.rotation.order = 'YXZ';
    this.camera.position.copy(this.player);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.scene.add(this.camera);
    this.flashlight = new THREE.SpotLight('#ccd4e1', 0, 24, .37, .54, 1.4);
    this.flashlight.position.set(.2, -.15, -.25); this.flashlight.target.position.set(0, 0, -12);
    this.camera.add(this.flashlight, this.flashlight.target);
    this.scene.add(this.effectLight);
    const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new OutputPass());
    this.antialias = new ShaderPass(FXAAShader);
    this.composer.addPass(this.antialias);
    this.post = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, time: { value: 0 }, nightVision: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float nightVision; varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float lum=dot(c,vec3(.2126,.7152,.0722));
      c=mix(vec3(lum),c,.82);c*=vec3(.98,1.,.99);float vignette=smoothstep(.83,.19,distance(vUv,vec2(.5,.48)));c*=.76+vignette*.24;
      if(nightVision>.5){float n=pow(lum,.63)*1.5;c=vec3(n*.62,n*.86,n*.54);}
      c+=(hash(vUv*vec2(1400.,900.)+fract(time))-.5)*.012;gl_FragColor=vec4(c,1.);}`,
    });
    this.composer.addPass(this.post);
    this.weaponModel = new WeaponModel(true, 'stillwater'); this.viewScene.add(this.weaponModel.group);
    this.viewScene.add(new THREE.HemisphereLight('#c3c9d2', '#373e4b', 2.4));
    const gunLight = new THREE.DirectionalLight('#c3d6d6', 2.8); gunLight.position.set(-2, 4, -2); this.viewScene.add(gunLight);
    const gunFill = new THREE.DirectionalLight('#99a9c3', 1.3); gunFill.position.set(3, 1, 2); this.viewScene.add(gunFill);
    this.viewScene.environment = this.environment.texture; this.viewScene.environmentIntensity = .85;
    this.resizeObserver = new ResizeObserver(this.resize); this.resizeObserver.observe(container);
    this.resize(); this.installEvents(); this.setSettings(settings);
    void this.initializeActors();
    this.frame = requestAnimationFrame(this.update);
    (window as unknown as { __PANDA__: unknown }).__PANDA__ = {
      snapshot: () => this.getSnapshot(),
      diagnostics: () => ({ fps: Math.round(1 / this.smoothFrameTime), renderedFrames: this.renderedFrames, renderScale: this.renderScale, actors: this.actors.length, colliders: this.world.colliders.length, draws: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, player: this.player.toArray(), yaw: this.yaw, pitch: this.pitch }),
      actions: this,
    };
  }

  private async initializeActors() {
    await Promise.resolve();
    if (this.disposed) return;
    SQUAD_ROSTER.forEach((unit, i) => {
      const actor = new Actor(unit.id, 'ally', unit.x, unit.z, i); this.allies.push(actor); this.actors.push(actor); this.scene.add(actor.group);
    });
    [[1.7, -6.5], [5.4, -22.8], [-3.0, -25.3], [3.6, -32.5]].forEach(([x, z], i) => {
      const actor = new Actor(`S${i + 1}`, 'suspect', x, z, i); actor.morale = 65 + i * 10; this.suspects.push(actor); this.actors.push(actor); this.scene.add(actor.group);
    });
    [[-3.4, -10.9], [-3.55, -22.5]].forEach(([x, z], i) => {
      const actor = new Actor(`C${i + 1}`, 'civilian', x, z, i); this.civilians.push(actor); this.actors.push(actor); this.scene.add(actor.group);
    });
    this.world.update(0, 0, this.player);
    await Promise.all([this.renderer.compileAsync(this.scene, this.camera), this.renderer.compileAsync(this.viewScene, this.viewCamera)]);
    if (this.disposed) return;
    this.prepared = true;
    this.emit();
  }

  private resize = () => {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = w / h; this.viewCamera.updateProjectionMatrix();
    const ratio = this.renderer.getPixelRatio();
    this.renderer.setSize(w, h); this.composer.setPixelRatio(ratio); this.composer.setSize(w, h);
    this.antialias.uniforms.resolution.value.set(1 / (w * ratio), 1 / (h * ratio));
    this.renderDirty = true;
  };

  private installEvents() {
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('mousemove', this.mouseMove);
    document.addEventListener('mouseup', this.mouseUp);
    document.addEventListener('pointerlockchange', this.lockChange);
    document.addEventListener('pointerlockerror', this.lockError);
    this.renderer.domElement.addEventListener('mousedown', this.mouseDown);
    this.renderer.domElement.addEventListener('contextmenu', this.contextMenu);
  }

  private keyDown = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (event.code === 'Enter' && this.state.phase === 'staging' && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); this.deploy(); return; }
    if (this.state.phase !== 'active') return;
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (event.repeat) return;
    switch (event.code) {
      case 'KeyR': this.reload(); break;
      case 'KeyE': this.interact(); break;
      case 'Space': this.shout(); break;
      case 'KeyG': this.flashbang(); break;
      case 'KeyF': this.toggleFlashlight(); break;
      case 'KeyN': this.toggleNightVision(); break;
      case 'KeyC': case 'ControlLeft': this.toggleCrouch(); break;
      case 'Digit1': this.order('fall-in'); break;
      case 'Digit2': this.order('hold'); break;
      case 'Digit3': this.order('clear'); break;
      case 'Digit4': this.protocol('guard'); break;
      case 'Digit5': this.protocol('recon'); break;
      case 'Digit6': this.protocol('sync'); break;
      case 'Digit7': this.protocol('burst'); break;
      case 'Tab': case 'KeyM': this.noteMapCheck(); this.pause(); this.onMenu('map'); break;
      case 'KeyH': this.pause(); this.onMenu('manual'); break;
      case 'Escape': this.pause(); break;
    }
  };
  private keyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private mouseMove = (event: MouseEvent) => {
    if (this.state.phase === 'active' && (this.state.locked || this.dragging)) this.look(event.movementX, event.movementY);
  };
  private mouseDown = (event: MouseEvent) => {
    if (this.state.phase !== 'active') return;
    if (event.button === 2) { this.state.aiming = true; this.dragging = !this.state.locked; return; }
    if (event.button !== 0) return;
    if (!this.state.locked) { this.focus(); this.dragging = true; if (this.fallbackReported) this.shoot(); }
    else { this.shoot(); this.firing = true; }
  };
  private mouseUp = (event: MouseEvent) => {
    if (event.button === 0) this.firing = false;
    if (event.button === 2) this.state.aiming = false;
    this.dragging = false;
  };
  private contextMenu = (event: Event) => event.preventDefault();
  private onBlur = () => { if (this.state.phase === 'active') this.pause(); };
  private lockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    this.state.locked = locked;
    if (!locked && this.hadLock && this.state.phase === 'active') this.pause();
    this.hadLock = locked;
    this.emit();
  };
  private lockError = () => {
    if (!this.fallbackReported) { this.fallbackReported = true; this.log('SYSTEM', '拖动画面观察，或使用方向键。控制已就绪。'); }
  };

  focus = () => {
    this.audio.init();
    if (window.matchMedia('(pointer:coarse)').matches) return;
    if (this.state.phase !== 'active' || document.pointerLockElement === this.renderer.domElement) return;
    try {
      const promise = this.renderer.domElement.requestPointerLock();
      if (promise && typeof promise.catch === 'function') void promise.catch(this.lockError);
    } catch { this.lockError(); }
  };

  deploy = () => {
    if (!this.state.ready || this.state.phase !== 'staging') return;
    this.state.phase = 'active';
    this.audio.init(); this.audio.setVolume(this.settings.volume);
    this.log('PANDA', '行动开始。4—7 切换策略；扫描、守护、协同与突破都会产生不同后果。');
    this.focus(); this.emit();
  };

  pause = () => {
    if (this.state.phase !== 'active') return;
    this.state.phase = 'paused';
    this.keys.clear(); this.firing = false; this.dragging = false; this.state.aiming = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.emit();
  };

  resume = () => {
    if (this.state.phase !== 'paused') return;
    this.state.phase = 'active'; this.focus(); this.emit();
  };

  restart = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    const weapon = this.state.weapon;
    this.state = initialSnapshot(); this.state.ready = true; this.state.weapon = weapon;
    const spec = WEAPONS[weapon]; this.state.ammo = spec.capacity; this.state.reserve = spec.reserve;
    this.player.set(.7, 1.7, 20); this.yaw = .025; this.pitch = -.008; this.recoil = this.recoilRoll = 0;
    this.keys.clear(); this.firing = this.dragging = false; this.fireTimer = this.reloadTimer = this.shoutTimer = 0;
    this.showExtractionNotified = false; this.fallInTrail = [];
    this.lastContactTime = this.lastDamageTime = this.lastScanTime = -999;
    this.marketTickTimer = 0; this.marketRandom = seeded(20261101);
    this.world.reset(); this.actors.forEach(a => a.reset());
    this.flashlight.intensity = 0; this.post.uniforms.nightVision.value = 0;
    this.renderer.toneMappingExposure = .92; this.effectLight.intensity = 0;
    this.renderDirty = true;
    this.transients.forEach(t => this.removeTransient(t)); this.transients.length = 0;
    this.emit();
  };

  input = (key: string, down: boolean) => { if (down) this.keys.add(key); else this.keys.delete(key); };
  setMenuOpen = (open: boolean) => { this.interfaceOpen = open; if (!open) this.renderDirty = true; };
  look = (x: number, y: number) => {
    if (this.state.phase !== 'active') return;
    const multiplier = (.0008 + this.settings.sensitivity * .000027) * (this.state.aiming ? .66 : 1);
    this.yaw -= x * multiplier;
    this.pitch = THREE.MathUtils.clamp(this.pitch - y * multiplier * (this.settings.invertY ? -1 : 1), -1.38, 1.38);
  };

  order = (order: Order) => {
    if (!['active', 'staging', 'paused'].includes(this.state.phase) || this.state.order === order) return;
    this.state.order = order;
    this.state.metrics.orderChanges++;
    if (this.state.elapsed - this.lastContactTime < 8 || this.state.elapsed - this.lastDamageTime < 8) this.state.metrics.adaptiveOrders++;
    this.allies.forEach(a => { a.path = []; a.pathTimer = 0; });
    const messages = { 'fall-in': '收拢队形，跟我推进。', hold: '原地守候，交叉覆盖射界。', clear: '移动清场，保持识别，别误伤。' };
    this.log('FEN', messages[order]); this.emit();
  };

  private targetExposure() {
    if (this.state.protocol === 'guard') return .2;
    if (this.state.protocol === 'recon') return 0;
    if (this.state.protocol === 'sync') return .45;
    return this.state.protocolActive > 0 ? .8 : .35;
  }

  private syncExposure() {
    const next = this.targetExposure(), market = this.state.market;
    const change = Math.abs(next - market.exposure);
    if (change < .001) return;
    market.turnover += change; market.trades++; market.exposure = next;
  }

  private updateMarket(dt: number) {
    const market = this.state.market;
    market.exposureIntegral += market.exposure * dt;
    market.averageExposure = market.exposureIntegral / Math.max(1, this.state.elapsed);
    this.marketTickTimer += dt;
    if (this.marketTickTimer < 4) return;
    this.marketTickTimer -= 4;
    const alerted = this.suspects.some(s => s.state === 'active' && s.alerted);
    const regime = this.state.threats >= 4 ? '证据修复' : alerted ? '急跌冲击' : this.state.doorOpen ? '高波动' : '观察期';
    const drift = regime === '证据修复' ? .0032 : regime === '急跌冲击' ? -.0045 : regime === '高波动' ? -.0008 : .0005;
    const volatility = regime === '观察期' ? .003 : regime === '证据修复' ? .006 : .011;
    const marketReturn = drift + (this.marketRandom() - .5) * volatility;
    market.regime = regime; market.lastReturn = marketReturn;
    market.equity = Math.max(1000, market.equity * (1 + marketReturn * market.exposure));
    market.peak = Math.max(market.peak, market.equity);
    market.maxDrawdown = Math.max(market.maxDrawdown, (market.peak - market.equity) / market.peak);
    market.ticks = [...market.ticks.slice(-47), Math.round(market.equity)];
  }

  protocol = (protocol: Protocol) => {
    if (this.state.phase !== 'active' && this.state.phase !== 'staging') return;
    const repeated = this.state.protocol === protocol;
    this.state.protocol = protocol;
    this.syncExposure();
    if (protocol === 'recon' && this.state.phase === 'active' && (repeated || this.state.protocolCooldown <= .0001)) this.scan();
    if (protocol === 'burst' && this.state.phase === 'active' && repeated && this.state.protocolCooldown <= .0001) this.activateBurst();
    if (protocol === 'guard') this.log('PANDA', repeated ? '盾线守护持续生效。靠近队友或平民，记录有效守护。' : '稳态守护：减伤提升，机动略降。');
    if (protocol === 'sync') this.log('PANDA', '协同演算：小队共享目标，射速与机动提升。');
    this.audio.click(); this.emit();
  };

  noteMapCheck = () => { this.state.metrics.mapChecks++; };

  private scan() {
    if (this.state.protocolCooldown > .0001) { this.log('PANDA', `扫描冷却 ${Math.ceil(this.state.protocolCooldown)} 秒。`); return; }
    this.state.protocolCooldown = 12; this.state.scanPulse = 5; this.lastScanTime = this.state.elapsed;
    this.state.metrics.reconScans++;
    const contacts = this.suspects.filter(s => s.state === 'active' && s.group.position.distanceTo(this.player) < 32).length;
    this.state.metrics.reconContacts += contacts;
    this.log('PANDA', `扫描脉冲：标记 ${contacts} 个活动威胁与附近线索，持续 5 秒。`);
    this.effectLight.position.copy(this.player); this.effectLight.color.set('#78d9c8'); this.effectLight.intensity = 90;
  }

  private activateBurst() {
    this.state.protocolActive = 6; this.state.protocolCooldown = 14;
    this.syncExposure(); this.state.metrics.burstActivations++;
    this.log('PANDA', '动能突破启动：6 秒高机动窗口，受击风险同步上升。');
  }

  setWeapon = (id: WeaponId) => {
    if (this.state.phase === 'active' || !WEAPONS[id]) return;
    if (this.state.weapon === id) return;
    this.state.weapon = id; this.state.ammo = WEAPONS[id].capacity; this.state.reserve = WEAPONS[id].reserve;
    this.reloadTimer = 0; this.state.reloading = false;
    this.viewScene.remove(this.weaponModel.group); this.weaponModel.dispose();
    this.weaponModel = new WeaponModel(true, id); this.viewScene.add(this.weaponModel.group);
    this.renderDirty = true;
    this.audio.click(); this.emit();
  };

  setSettings = (settings: Settings) => {
    this.settings = { ...settings }; this.audio.setVolume(settings.volume);
    const high = settings.quality === 'high';
    this.world.setQuality(high);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 1.5 : 1) * this.renderScale);
    this.renderer.shadowMap.enabled = true; this.resize();
  };

  toggleFlashlight = () => {
    if (this.state.phase !== 'active') return;
    this.state.flashlight = !this.state.flashlight; this.flashlight.intensity = this.state.flashlight ? 30 : 0; this.audio.click(); this.emit();
  };
  toggleNightVision = () => {
    if (this.state.phase !== 'active') return;
    this.state.nightVision = !this.state.nightVision; this.post.uniforms.nightVision.value = this.state.nightVision ? 1 : 0;
    this.renderer.toneMappingExposure = this.state.nightVision ? 1.8 : .92;
    this.audio.click(); this.emit();
  };
  toggleCrouch = () => { if (this.state.phase === 'active') { this.state.crouching = !this.state.crouching; this.emit(); } };

  reload = () => {
    if (this.state.phase !== 'active' || this.state.reloading || this.state.ammo === WEAPONS[this.state.weapon].capacity || this.state.reserve <= 0) return;
    this.state.reloading = true; this.reloadTimer = WEAPONS[this.state.weapon].reload; this.audio.reload(); this.emit();
  };

  shoot = () => {
    if (this.state.phase !== 'active' || this.state.reloading || this.fireTimer > 0) return;
    if (this.state.ammo <= 0) { this.audio.click(); this.reload(); return; }
    const spec = WEAPONS[this.state.weapon];
    if (this.state.shots === 0 && this.state.metrics.reconScans === 0) this.state.metrics.firstShotBeforeScan = true;
    this.state.ammo--; this.state.shots++;
    this.fireTimer = spec.interval * (this.state.protocol === 'burst' && this.state.protocolActive > 0 ? .72 : 1);
    this.recoil = spec.nonlethal ? .15 : .075; this.recoilRoll = (this.random() - .5) * .04;
    this.pitch = Math.min(1.35, this.pitch + (this.state.aiming ? .0025 : .005));
    this.weaponModel.flash.visible = true;
    this.audio.shoot(spec.nonlethal);
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    const spread = this.state.aiming ? .0014 : .007;
    direction.x += (this.random() - .5) * spread; direction.y += (this.random() - .5) * spread; direction.normalize();
    const ray = new THREE.Ray(this.camera.position.clone(), direction);
    let closest = 90; let victim: Actor | null = null;
    const woodDistances: number[] = [];
    const point = new THREE.Vector3();
    for (const collider of this.world.colliders) {
      if (!collider.enabled || !ray.intersectBox(collider.box, point)) continue;
      const d = ray.origin.distanceTo(point);
      if (d < closest) {
        if (collider.kind === 'wood' && !spec.nonlethal) { woodDistances.push(d); continue; }
        closest = d;
      }
    }
    for (const actor of this.actors) {
      if (actor.state === 'down') continue;
      const pos = actor.group.position, height = actor.state === 'secured' ? 1.28 : 1.89;
      const bounds = new THREE.Box3(new THREE.Vector3(pos.x - .31, 0, pos.z - .26), new THREE.Vector3(pos.x + .31, height, pos.z + .26));
      if (ray.intersectBox(bounds, point)) {
        const distance = ray.origin.distanceTo(point);
        if (distance < closest) { closest = distance; victim = actor; }
      }
    }
    const end = ray.at(closest, new THREE.Vector3());
    const penetration = woodDistances.some(distance => distance < closest) ? .57 : 1;
    if (victim) {
      this.state.hits++; this.state.hitMarker = .22;
      if (victim.kind === 'suspect') {
        if (spec.nonlethal) this.surrender(victim);
        else this.damageActor(victim, spec.damage * penetration * (end.y > 1.55 ? 1.4 : 1), true);
      } else {
        this.state.score = Math.max(0, this.state.score - 250);
        this.log('TOC', victim.kind === 'ally' ? '注意射界，目标是己方队员。' : '平民受击。开火前必须识别目标。');
        this.damageActor(victim, spec.damage, true);
      }
    }
    const muzzle = this.camera.position.clone().add(direction.clone().multiplyScalar(.65));
    muzzle.y -= .14; this.tracer(muzzle, end, '#a0aec7', .065);
    if (!victim) this.impact(end);
    this.emit();
  };

  private damageActor(actor: Actor, damage: number, player: boolean) {
    if (actor.state === 'down') return;
    const before = actor.health;
    actor.health = Math.max(0, actor.health - damage);
    if (actor.kind === 'ally') this.state.metrics.squadDamage += before - actor.health;
    if (actor.kind === 'suspect') actor.alerted = true;
    if (actor.health > 0) return;
    if (actor.kind === 'suspect') {
      if (player && this.state.protocol === 'burst' && this.state.protocolActive > 0) this.state.metrics.burstKills++;
      if (!player && this.state.protocol === 'sync') this.state.metrics.syncAssists++;
      if (actor.state === 'secured') { this.state.arrested--; }
      else { this.state.threats++; }
      if (actor.state === 'surrendered' || actor.state === 'secured') { this.state.score = Math.max(0, this.state.score - 350); this.log('TOC', '违规使用武力。嫌疑人已经服从指令。'); }
      else this.state.score += 100;
      this.state.neutralized++;
      this.log(player ? 'FEN' : 'ALPHA', '嫌疑人倒地。继续覆盖各自射界。');
    } else if (actor.kind === 'civilian') {
      if (actor.state === 'secured') this.state.civilians--;
      this.state.civilianLosses++; this.state.score = Math.max(0, this.state.score - 500);
      this.log('TOC', '报告平民伤亡。继续完成任务。');
    } else {
      this.log('TOC', `${SQUAD_ROSTER.find(a => a.id === actor.id)?.name ?? actor.id} 倒地。重新集结并完成任务。`);
    }
    actor.state = 'down'; actor.moving = false;
  }

  private surrender(actor: Actor) {
    if (actor.state !== 'active') return;
    actor.state = 'surrendered'; actor.moving = false; actor.path = []; actor.stunned = 0;
    this.log('SUSPECT', '好！我放下武器，别开枪。');
  }

  shout = () => {
    if (this.state.phase !== 'active' || this.shoutTimer > 0) return;
    this.shoutTimer = 1.15;
    this.log('FEN', '放下武器！双手放在可见位置！');
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    let heard = false;
    for (const suspect of this.suspects) {
      if (suspect.state !== 'active') continue;
      const target = suspect.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      const delta = target.clone().sub(this.player), distance = delta.length();
      if (distance > 14 || delta.normalize().dot(forward) < .18 || !visibleBetween(this.player, target, this.world.colliders)) continue;
      heard = true; suspect.shouts++; suspect.morale -= 55;
      if (suspect.stunned > 0 || suspect.shouts >= 2 || suspect.index === 0) this.surrender(suspect);
      else { suspect.alerted = true; suspect.shootTimer = Math.max(.8, suspect.shootTimer); this.log('SUSPECT', '退后！不要再靠近。'); }
    }
    if (!heard && this.civilians.some(c => c.state === 'active' && c.group.position.distanceTo(this.player) < 12)) this.log('CIVILIAN', '我没有武器！请带我离开这里。');
    this.emit();
  };

  flashbang = () => {
    if (this.state.phase !== 'active' || this.state.grenades <= 0) return;
    this.state.grenades--; this.state.metrics.flashbangs++;
    const direction = this.camera.getWorldDirection(new THREE.Vector3()); direction.y = -.06; direction.normalize();
    let distance = 8;
    const ray = new THREE.Ray(this.player.clone(), direction), point = new THREE.Vector3();
    this.world.colliders.forEach(c => { if (c.enabled && ray.intersectBox(c.box, point)) distance = Math.min(distance, Math.max(.6, this.player.distanceTo(point) - .4)); });
    const position = ray.at(distance, new THREE.Vector3()); position.y = .8;
    const grenade = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 8), new THREE.MeshPhongMaterial({ color: '#4a5361', shininess: 25 }));
    grenade.position.copy(position); this.scene.add(grenade); this.transients.push({ object: grenade, time: .35, maxTime: .35 });
    this.effectLight.position.copy(position); this.effectLight.color.set('#dfe4ed'); this.effectLight.intensity = 270;
    this.state.flash = distance < 5 ? .72 : .28; this.audio.flashbang();
    this.log('FEN', '震爆弹已投出。爆炸后推进。');
    this.suspects.forEach(s => {
      if (s.state === 'active' && s.group.position.distanceTo(position) < 10 && visibleBetween(position, s.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), this.world.colliders)) {
        s.stunned = 8; s.morale = 0; s.shootTimer = 4;
      }
    });
    this.emit();
  };

  private interaction(): Interaction | null {
    const distance = (p: THREE.Vector3) => Math.hypot(this.player.x - p.x, this.player.z - p.z);
    if (this.readyForExtraction() && distance(this.world.extraction) < 4.5) return { type: 'extract', label: '确认撤离并生成人格报告' };
    for (const suspect of this.suspects) if (suspect.state === 'surrendered' && distance(suspect.group.position) < 3.0 && visibleBetween(this.player, suspect.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), this.world.colliders)) return { type: 'arrest', label: '约束已投降嫌疑人', actor: suspect };
    for (const civilian of this.civilians) if (civilian.state === 'active' && distance(civilian.group.position) < 3.0 && visibleBetween(this.player, civilian.group.position.clone().add(new THREE.Vector3(0, 1.4, 0)), this.world.colliders)) return { type: 'civilian', label: '保护并转移平民', actor: civilian };
    for (let i = 0; i < this.world.intelNodes.length; i++) if (this.world.intelNodes[i].visible && distance(this.world.intelPositions[i]) < 2.8) return { type: 'intel', label: `读取行为线索 0${i + 1}`, index: i };
    if (!this.world.doors[0].open && distance(this.world.entry) < 3.6) return { type: 'door', label: '开启仓库安全门' };
    if (!this.state.evidence && distance(this.world.evidencePosition) < 2.7 && this.player.z < -28) return { type: 'evidence', label: '收集货单与调度证据' };
    return null;
  }

  interact = () => {
    if (this.state.phase !== 'active') return;
    const interaction = this.interaction(); if (!interaction) return;
    switch (interaction.type) {
      case 'door': this.breachDoor(); break;
      case 'arrest': {
        const actor = interaction.actor!; actor.state = 'secured'; this.state.threats++; this.state.arrested++; this.state.score += 250;
        if (this.state.elapsed - this.lastScanTime < 9) this.state.metrics.scanArrests++;
        this.log('FEN', '嫌疑人已约束。保护证据链，继续观察。'); this.audio.click(); break;
      }
      case 'civilian': {
        interaction.actor!.state = 'secured'; this.state.civilians++; this.state.score += 300;
        if (this.state.threats < 4) this.state.metrics.civiliansBeforeClear++;
        this.log('PANDA', '平民已安全转移。守护行为已记入评估。'); this.audio.click(); break;
      }
      case 'intel': {
        const index = interaction.index!;
        this.world.intelNodes[index].visible = false; this.state.intel++; this.state.metrics.intel++;
        if (this.state.threats === 0) this.state.metrics.earlyIntel++;
        this.state.score += 120;
        const clues = ['货流记录：同一批箱子在雨夜被反复转运。', '现场弹痕：两条射界交叉，正面突入并非唯一解。', '调度日志：嫌疑人也在等待一个尚未到达的信号。'];
        this.log('PANDA', clues[index]); this.audio.click(); break;
      }
      case 'evidence':
        this.state.evidence = true; this.state.metrics.evidenceBeforeClear = this.state.threats < 4;
        this.state.score += 250; this.world.evidence.visible = false;
        this.log('FEN', this.state.metrics.evidenceBeforeClear ? '在清场前取得货单：你优先固定了上下文证据。' : '货单与调度证据已回收。'); this.audio.click(); break;
      case 'extract': this.finish(); break;
    }
    this.checkExtraction(); this.emit();
  };

  private breachDoor() {
    if (this.world.doors[0].open) return;
    this.world.doors[0].open = true; this.world.doors[0].collider.enabled = false; this.state.doorOpen = true;
    this.audio.door(); this.log('ALPHA', '安全门已开启。进入仓库，注意拐角。');
    this.allies.forEach(a => { a.pathTimer = 0; a.path = []; });
  }

  private readyForExtraction() { return this.state.threats >= 4 && this.state.civilians + this.state.civilianLosses >= 2 && this.state.evidence; }
  private checkExtraction() {
    if (this.readyForExtraction() && !this.showExtractionNotified) {
      this.showExtractionNotified = true;
      this.log('TOC', '全部目标已完成。返回进入点撤离并生成报告。'); this.audio.success();
    }
  }

  private finish() {
    if (!this.readyForExtraction()) return;
    this.state.extracted = true; this.state.phase = 'complete'; this.state.market.regime = '任务收盘';
    this.state.score += 300 + Math.round(this.state.health * 2) + this.allies.filter(a => a.state !== 'down').length * 75;
    this.keys.clear(); this.firing = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.log('TOC', '行动完成。全员撤离，正在生成你的交易人格报告。'); this.audio.success();
    try {
      const best = Number(localStorage.getItem('panda-meridian-best') ?? 0);
      if (this.state.score > best) localStorage.setItem('panda-meridian-best', String(this.state.score));
    } catch { /* Storage is optional in private browsing. */ }
    this.emit();
  }

  private hurtPlayer(damage: number) {
    if (this.state.phase !== 'active') return;
    this.lastDamageTime = this.state.elapsed;
    const mitigated = damage * (this.state.protocol === 'guard' ? .65 : 1) * (this.state.protocol === 'burst' && this.state.protocolActive > 0 ? 1.18 : 1);
    this.state.metrics.damageTaken += mitigated;
    const absorb = Math.min(this.state.armor, mitigated * .78);
    this.state.armor = Math.max(0, this.state.armor - absorb);
    this.state.health = Math.max(0, this.state.health - (mitigated - absorb));
    this.state.damage = .65; this.audio.hit();
    if (this.state.health <= 0) {
      this.state.phase = 'failed'; this.keys.clear(); this.firing = false;
      if (document.pointerLockElement) document.exitPointerLock();
      this.log('TOC', '行动者失去战斗能力。小队撤退，任务中止。'); this.emit();
    }
  }

  private log(source: string, text: string) {
    this.state.radio = [...this.state.radio.slice(-8), { id: this.radioId++, source, text, time: this.state.elapsed }];
    this.audio.radio();
    if (this.settings.radioVoice && source !== 'SYSTEM') this.audio.speak(text);
  }

  private updatePlayer(dt: number, time: number) {
    const forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
    const strafe = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
    const inputLength = Math.hypot(forward, strafe);
    const sprint = this.keys.has('ShiftLeft') && !this.state.aiming && !this.state.crouching;
    const baseSpeed = this.state.crouching ? 1.6 : this.state.aiming ? 1.8 : sprint ? 4.3 : 2.8;
    const protocolSpeed = this.state.protocol === 'guard' ? .88 : this.state.protocol === 'burst' && this.state.protocolActive > 0 ? 1.28 : 1;
    const speed = baseSpeed * protocolSpeed;
    if (inputLength) {
      const dx = (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) / inputLength * speed * dt;
      const dz = (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) / inputLength * speed * dt;
      moveWithCollision(this.player, dx, dz, this.world.colliders);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) { this.audio.step(); this.stepTimer = sprint ? .29 : this.state.crouching ? .62 : .43; }
    }
    const angularSpeed = 1.25 * dt;
    if (this.keys.has('ArrowLeft')) this.yaw += angularSpeed;
    if (this.keys.has('ArrowRight')) this.yaw -= angularSpeed;
    if (this.keys.has('ArrowUp')) this.pitch = Math.min(1.3, this.pitch + angularSpeed);
    if (this.keys.has('ArrowDown')) this.pitch = Math.max(-1.3, this.pitch - angularSpeed);
    this.player.y = THREE.MathUtils.damp(this.player.y, this.state.crouching ? 1.09 : 1.7, 10, dt);
    this.camera.position.copy(this.player);
    if (inputLength) this.camera.position.y += Math.sin(time * (sprint ? 12 : 8)) * (this.state.aiming ? .008 : .018);
    this.camera.rotation.set(this.pitch + this.recoil * .1, this.yaw, this.recoilRoll * .12, 'YXZ');
    const fov = this.state.aiming ? 49 : sprint && inputLength ? 71 : 67;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, fov, 10, dt); this.camera.updateProjectionMatrix();
    if (!this.fallInTrail.length || this.player.distanceTo(this.fallInTrail[this.fallInTrail.length - 1]) > .9) {
      this.fallInTrail.push(this.player.clone()); if (this.fallInTrail.length > 35) this.fallInTrail.shift();
    }
  }

  private updateSquad(dt: number) {
    this.allies.forEach((ally, index) => {
      if (ally.state === 'down') return;
      ally.moving = false;
      const nearTarget = this.suspects.filter(s => s.state === 'active').sort((a, b) => ally.group.position.distanceToSquared(a.group.position) - ally.group.position.distanceToSquared(b.group.position))[0];
      let goal: THREE.Vector3 | null = null;
      if (this.state.order === 'fall-in') {
        const trailIndex = Math.max(0, this.fallInTrail.length - 3 - index * 2);
        const base = this.fallInTrail[trailIndex] ?? this.player;
        const offsetX = (index % 2 ? 1 : -1) * 1.1;
        goal = new THREE.Vector3(base.x + offsetX * Math.cos(this.yaw), 0, base.z - offsetX * Math.sin(this.yaw) + 1.2);
        if (!canOccupy(goal.x, goal.z, this.world.colliders)) goal.set(base.x, 0, base.z);
      } else if (this.state.order === 'clear' && nearTarget) {
        if (!this.world.doors[0].open && nearTarget.group.position.z < -16) {
          goal = new THREE.Vector3((index % 2 ? 1 : -1) * .85, 0, -13.6 + Math.floor(index / 2));
          if (ally.group.position.distanceTo(goal) < 1.3) this.breachDoor();
        } else {
          const toward = ally.group.position.clone().sub(nearTarget.group.position).normalize();
          goal = nearTarget.group.position.clone().add(toward.multiplyScalar(4 + index * .5)); goal.y = 0;
        }
      }
      if (goal && ally.group.position.distanceTo(goal) > 1.2) {
        ally.pathTimer -= dt;
        if (ally.pathTimer <= 0) {
          ally.pathTimer = 1.2 + index * .13;
          const from = ally.group.position.clone().add(new THREE.Vector3(0, .8, 0)), to = goal.clone().add(new THREE.Vector3(0, .8, 0));
          ally.path = visibleBetween(from, to, this.world.colliders) ? [goal] : findPath(ally.group.position, goal, this.world.colliders);
        }
        const next = ally.path[0];
        if (next) {
          const delta = next.clone().sub(ally.group.position); delta.y = 0;
          if (delta.length() < .42) ally.path.shift();
          else {
            delta.normalize();
            const squadSpeed = this.state.protocol === 'sync' ? 3.05 : 2.48;
            moveWithCollision(ally.group.position, delta.x * dt * squadSpeed, delta.z * dt * squadSpeed, this.world.colliders, .27);
            const targetAngle = Math.atan2(delta.x, delta.z);
            ally.group.rotation.y += Math.atan2(Math.sin(targetAngle - ally.group.rotation.y), Math.cos(targetAngle - ally.group.rotation.y)) * Math.min(1, dt * 7);
            ally.moving = true;
          }
        }
      }
      if (nearTarget && nearTarget.alerted && nearTarget.stunned <= 0 && ally.group.position.distanceTo(nearTarget.group.position) < 15) {
        const origin = ally.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)), target = nearTarget.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        if (visibleBetween(origin, target, this.world.colliders)) {
          ally.group.rotation.y = Math.atan2(target.x - origin.x, target.z - origin.z);
          if (ally.shootTimer <= 0) {
            ally.shootTimer = (this.state.protocol === 'sync' ? 1.35 : 2.1) + index * .25; ally.flashTimer = .085;
            this.tracer(origin, target, '#a7b4cb', .07); this.audio.shoot(false, true);
            this.damageActor(nearTarget, 16, false);
          }
        }
      }
    });
  }

  private updateSuspects(dt: number) {
    for (const suspect of this.suspects) {
      if (suspect.state !== 'active') continue;
      const origin = suspect.group.position.clone().add(new THREE.Vector3(0, 1.4, 0));
      const distance = origin.distanceTo(this.player);
      const lineOfSight = distance < 32 && visibleBetween(this.player, origin, this.world.colliders);
      suspect.visibleToPlayer = lineOfSight || (this.state.scanPulse > 0 && distance < 32);
      if (lineOfSight) this.lastContactTime = this.state.elapsed;
      if (suspect.stunned > 0 || distance > 18 || !lineOfSight) continue;
      if (!suspect.alerted) {
        suspect.alerted = true; suspect.shootTimer = 2.5;
        this.log('ALPHA', '接触武装嫌疑人。先识别，可空格劝降，或按 5 扫描后交叉验证。');
      }
      const target = this.player.clone();
      let targetAlly: Actor | null = null;
      if (this.random() > .68) {
        targetAlly = this.allies.find(a => a.state === 'active' && a.group.position.distanceTo(suspect.group.position) < distance * .8 && visibleBetween(origin, a.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)), this.world.colliders)) ?? null;
        if (targetAlly) target.copy(targetAlly.group.position).y = 1.3;
      }
      suspect.group.rotation.y = Math.atan2(target.x - origin.x, target.z - origin.z);
      if (suspect.shootTimer <= 0) {
        suspect.shootTimer = 1.85 + this.random() * .7; suspect.flashTimer = .09;
        this.tracer(origin, target, '#869cc1', .08); this.audio.shoot(false, true);
        const hitChance = this.state.crouching ? .38 : distance > 13 ? .48 : .68;
        if (this.random() < hitChance) {
          if (targetAlly) this.damageActor(targetAlly, 11, false);
          else this.hurtPlayer(12);
        }
      }
    }
  }

  private tracer(from: THREE.Vector3, to: THREE.Vector3, color: string, duration: number) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .65, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(line); this.transients.push({ object: line, time: duration, maxTime: duration });
  }

  private impact(position: THREE.Vector3) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 5; i++) { points.push(position.clone()); points.push(position.clone().add(new THREE.Vector3((this.random() - .5) * .2, this.random() * .2, (this.random() - .5) * .2))); }
    const sparks = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#a9b6cc', transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(sparks); this.transients.push({ object: sparks, time: .13, maxTime: .13 });
  }

  private removeTransient(transient: Transient) {
    this.scene.remove(transient.object);
    if (transient.object instanceof THREE.Mesh || transient.object instanceof THREE.Line) {
      transient.object.geometry.dispose();
      (Array.isArray(transient.object.material) ? transient.object.material : [transient.object.material]).forEach(m => m.dispose());
    }
    if (transient.object instanceof THREE.Light) transient.object.dispose();
  }

  private update = (timestamp: number) => {
    if (this.disposed) return;
    const rawDt = this.lastFrameTime ? (timestamp - this.lastFrameTime) / 1000 : 1 / 60;
    this.lastFrameTime = timestamp; this.smoothFrameTime = this.smoothFrameTime * .95 + Math.min(rawDt, .25) * .05;
    const dt = Math.min(rawDt, .12); this.totalTime += dt;
    const time = this.totalTime;
    if (!this.prepared) { this.frame = requestAnimationFrame(this.update); return; }
    const frozen = this.interfaceOpen || this.state.phase === 'paused' || this.state.phase === 'complete' || this.state.phase === 'failed';
    if (frozen && this.state.ready && !this.renderDirty) { this.frame = requestAnimationFrame(this.update); return; }
    this.world.update(time, dt, this.player);
    if (this.state.phase === 'active') {
      this.state.elapsed += dt;
      const burstWasActive = this.state.protocolActive > 0;
      this.state.protocolCooldown = Math.max(0, this.state.protocolCooldown - dt);
      this.state.protocolActive = Math.max(0, this.state.protocolActive - dt);
      if (burstWasActive && this.state.protocolActive === 0) this.syncExposure();
      this.updateMarket(dt);
      this.state.scanPulse = Math.max(0, this.state.scanPulse - dt);
      this.state.metrics.protocolSeconds[this.state.protocol] += dt;
      this.state.metrics.orderUse[this.state.order] += dt;
      const nearSquad = this.allies.some(a => a.state !== 'down' && a.group.position.distanceTo(this.player) < 6);
      const nearCivilian = this.civilians.some(c => c.state === 'active' && c.group.position.distanceTo(this.player) < 7);
      if (nearSquad) this.state.metrics.nearSquadSeconds += dt; else this.state.metrics.loneSeconds += dt;
      if (this.state.protocol === 'guard' && (nearSquad || nearCivilian)) this.state.metrics.guardSeconds += dt;
      this.fireTimer = Math.max(0, this.fireTimer - dt); this.shoutTimer = Math.max(0, this.shoutTimer - dt);
      this.state.hitMarker = Math.max(0, this.state.hitMarker - dt);
      this.state.damage = Math.max(0, this.state.damage - dt * 1.6);
      this.state.flash = Math.max(0, this.state.flash - dt * 1.9);
      this.updatePlayer(dt, time);
      if (this.firing) this.shoot();
      if (this.state.reloading) {
        this.reloadTimer -= dt;
        this.state.reloadProgress = 1 - this.reloadTimer / WEAPONS[this.state.weapon].reload;
        if (this.reloadTimer <= 0) {
          const spec = WEAPONS[this.state.weapon], needed = Math.min(spec.capacity - this.state.ammo, this.state.reserve);
          this.state.ammo += needed; this.state.reserve -= needed; this.state.reloading = false; this.state.reloadProgress = 0; this.audio.reload();
        }
      }
      this.updateSquad(dt); this.updateSuspects(dt); this.checkExtraction();
      this.actors.forEach(a => a.update(dt, time));
    } else if (this.state.phase === 'staging') {
      this.camera.position.copy(this.player); this.camera.position.y += Math.sin(time * .6) * .003;
      this.camera.rotation.set(this.pitch, this.yaw + Math.sin(time * .2) * .0015, 0, 'YXZ');
      this.camera.fov = 67; this.camera.updateProjectionMatrix();
      this.actors.forEach(a => a.update(dt, time));
    }
    this.recoil = THREE.MathUtils.damp(this.recoil, 0, 15, dt); this.recoilRoll = THREE.MathUtils.damp(this.recoilRoll, 0, 15, dt);
    this.effectLight.intensity = THREE.MathUtils.damp(this.effectLight.intensity, 0, 35, dt);
    if (this.recoil < .045) this.weaponModel.flash.visible = false;
    const moving = this.state.phase === 'active' && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some(k => this.keys.has(k));
    const ads = this.state.aiming;
    const bob = moving ? Math.sin(time * 8) * (ads ? .003 : .007) : Math.sin(time * 1.4) * .0013;
    const reload = this.state.reloading ? Math.sin(this.state.reloadProgress * Math.PI) : 0;
    const targetX = ads ? 0 : .275, targetY = ads ? -.1645 : -.30;
    this.weaponModel.group.position.x = THREE.MathUtils.damp(this.weaponModel.group.position.x, targetX + bob, 12, dt);
    this.weaponModel.group.position.y = THREE.MathUtils.damp(this.weaponModel.group.position.y, targetY + bob - reload * .25, 12, dt);
    this.weaponModel.group.position.z = THREE.MathUtils.damp(this.weaponModel.group.position.z, (ads ? -.46 : -.64) + this.recoil, 13, dt);
    this.weaponModel.group.rotation.set(this.recoil * .8 + reload * .5, reload * -.4, (ads ? 0 : -.04) + this.recoilRoll - reload * .5);
    this.weaponModel.magazine.position.y = -Math.max(0, Math.sin(this.state.reloadProgress * Math.PI * 2)) * .19;
    for (let i = this.transients.length - 1; i >= 0; i--) {
      const t = this.transients[i]; t.time -= dt;
      if (t.time <= 0) { this.removeTransient(t); this.transients.splice(i, 1); }
      else if (t.object instanceof THREE.Line) (t.object.material as THREE.LineBasicMaterial).opacity = t.time / t.maxTime * .7;
    }
    this.post.uniforms.time.value = time;
    this.renderer.shadowMap.needsUpdate = this.renderDirty || this.renderedFrames % (this.state.phase === 'active' ? 3 : 8) === 0;
    this.composer.render();
    this.renderer.autoClear = false; this.renderer.clearDepth(); this.renderer.render(this.viewScene, this.viewCamera); this.renderer.autoClear = true;
    this.renderedFrames++;
    this.renderDirty = false;
    if (!this.state.ready) {
      this.state.ready = true;
      (window as unknown as { __GAME_READY__: boolean; __SCENE_READY__: boolean }).__GAME_READY__ = true;
      (window as unknown as { __GAME_READY__: boolean; __SCENE_READY__: boolean }).__SCENE_READY__ = true;
      this.emit();
    }
    if (this.renderedFrames > 40 && timestamp - this.lastResolutionChange > 4500) {
      let scale = this.renderScale;
      if (this.smoothFrameTime > .046 && scale > .66) scale = Math.max(.66, scale - .12);
      else if (this.smoothFrameTime < .019 && scale < 1) scale = Math.min(1, scale + .04);
      if (scale !== this.renderScale) {
        this.renderScale = scale; this.lastResolutionChange = timestamp;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.settings.quality === 'high' ? 1.5 : 1) * scale);
        this.resize();
      }
    }
    this.emitTimer += dt;
    if (this.emitTimer > .1) { this.emitTimer = 0; this.emit(); }
    this.frame = requestAnimationFrame(this.update);
  };

  private projectMarker(id: string, label: string, position: THREE.Vector3, kind: Marker['kind']): Marker {
    const projected = position.clone().project(this.camera);
    const distance = this.player.distanceTo(position);
    return { id, label, distance: Math.round(distance), x: (projected.x * .5 + .5) * 100, y: (-projected.y * .5 + .5) * 100, visible: projected.z < 1 && projected.z > -1 && Math.abs(projected.x) < .9 && Math.abs(projected.y) < .85, kind };
  }

  private markers(): Marker[] {
    const result: Marker[] = [];
    if (this.readyForExtraction()) result.push(this.projectMarker('extract', '撤离 · 生成身份卡', this.world.extraction.clone().setY(1.5), 'objective'));
    else if (!this.world.doors[0].open) result.push(this.projectMarker('entry', '仓库入口', this.world.entry.clone().setY(2.0), 'objective'));
    else {
      const suspect = this.suspects.filter(a => a.state === 'active' || a.state === 'surrendered').sort((a, b) => this.player.distanceToSquared(a.group.position) - this.player.distanceToSquared(b.group.position))[0];
      const civilian = this.civilians.find(a => a.state === 'active');
      if (suspect) result.push(this.projectMarker(suspect.id, suspect.state === 'surrendered' ? '约束嫌疑人' : '搜索并识别', suspect.group.position.clone().setY(2.15), 'objective'));
      else if (civilian) result.push(this.projectMarker(civilian.id, '保护平民', civilian.group.position.clone().setY(2.05), 'civilian'));
      else if (!this.state.evidence) result.push(this.projectMarker('manifest', '货单证据', this.world.evidencePosition.clone().setY(1.5), 'objective'));
    }
    const intelIndex = this.world.intelNodes.findIndex(node => node.visible);
    if (intelIndex >= 0) {
      const position = this.world.intelPositions[intelIndex];
      if (this.state.scanPulse > 0 || this.player.distanceTo(position) < 7) result.push(this.projectMarker(`intel-${intelIndex}`, `行为线索 0${intelIndex + 1}`, position.clone().setY(1.65), 'objective'));
    }
    this.allies.filter(a => a.state !== 'down').forEach(ally => {
      const position = ally.group.position.clone().setY(2.05);
      if (this.player.distanceTo(position) > 3 && this.player.distanceTo(position) < 21 && visibleBetween(this.player, position, this.world.colliders)) result.push(this.projectMarker(ally.id, ally.id, position, 'squad'));
    });
    return result;
  }

  getSnapshot(): GameSnapshot {
    const state = this.state;
    return {
      ...state, health: Math.ceil(state.health), armor: Math.ceil(state.armor),
      x: this.player.x, z: this.player.z, heading: ((-this.yaw * 180 / Math.PI) % 360 + 360) % 360,
      squad: SQUAD_ROSTER.map((unit, i) => {
        const actor = this.allies[i];
        return { ...unit, health: actor?.health ?? 100, x: actor?.group.position.x ?? unit.x, z: actor?.group.position.z ?? unit.z, status: actor?.state === 'down' ? 'DOWN' : state.phase === 'staging' ? 'READY' : actor?.flashTimer ? 'ENGAGING' : state.order === 'hold' ? 'HOLDING' : state.order === 'clear' ? 'CLEARING' : 'ON YOU' };
      }),
      markers: this.markers(), prompt: state.phase === 'active' ? this.interaction()?.label ?? '' : '',
      enemies: this.suspects.map(a => ({ id: a.id, x: a.group.position.x, z: a.group.position.z, state: a.state, visible: a.visibleToPlayer })),
    };
  }

  private emit() { if (!this.disposed) this.onSnapshot(this.getSnapshot()); }

  dispose() {
    if (this.disposed) return; this.disposed = true;
    cancelAnimationFrame(this.frame); this.resizeObserver.disconnect();
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    window.removeEventListener('keydown', this.keyDown); window.removeEventListener('keyup', this.keyUp); window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('mousemove', this.mouseMove); document.removeEventListener('mouseup', this.mouseUp);
    document.removeEventListener('pointerlockchange', this.lockChange); document.removeEventListener('pointerlockerror', this.lockError);
    this.renderer.domElement.removeEventListener('mousedown', this.mouseDown); this.renderer.domElement.removeEventListener('contextmenu', this.contextMenu);
    this.audio.dispose(); this.actors.forEach(a => a.dispose()); this.weaponModel.dispose(); this.world.dispose();
    this.transients.forEach(t => this.removeTransient(t)); this.environment.dispose();
    this.composer.passes.forEach(p => p.dispose()); this.composer.dispose(); this.renderer.dispose();
    this.renderer.domElement.remove();
    delete (window as unknown as { __PANDA__?: unknown }).__PANDA__;
  }
}
