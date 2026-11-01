import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, GearSix, Pause, ShieldChevron, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { GameEngine } from './game/engine';
import { DEFAULT_SETTINGS, initialSnapshot } from './game/types';
import type { GameSnapshot, Menu, Settings } from './game/types';
import { HUD } from './components/HUD';
import { Debrief, MenuOverlay, PauseOverlay } from './components/Overlays';
import { TouchControls } from './components/TouchControls';
import { PandaMark } from './components/PandaMark';

function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem('panda-meridian-settings') ?? '{}');
    return { ...DEFAULT_SETTINGS, volume: Math.max(0, Math.min(100, Number(saved.volume ?? 45))), sensitivity: Math.max(5, Math.min(100, Number(saved.sensitivity ?? 50))), quality: saved.quality === 'balanced' ? 'balanced' : 'high', invertY: saved.invertY === true, radioVoice: saved.radioVoice === true };
  } catch { return DEFAULT_SETTINGS; }
}

const GameViewport = memo(function GameViewport({ onReady, onSnapshot, onMenu, settings }: { onReady: (engine: GameEngine | null) => void; onSnapshot: (state: GameSnapshot) => void; onMenu: (menu: Menu) => void; settings: Settings }) {
  const container = useRef<HTMLDivElement>(null);
  const initialSettings = useRef(settings);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!container.current) return;
    let engine: GameEngine | null = null, cancelled = false;
    setError('');
    const initialize = async () => {
      await document.fonts.ready;
      if (cancelled) return;
      try { engine = new GameEngine(container.current!, onSnapshot, onMenu, initialSettings.current); onReady(engine); }
      catch (err) { console.error('3D 场景初始化失败：', err); setError('请开启浏览器硬件加速后重试。你的评估不会上传到服务器。'); }
    };
    void initialize();
    return () => { cancelled = true; onReady(null); engine?.dispose(); };
  }, [onReady, onSnapshot, onMenu, attempt]);
  return <div className="game-viewport" ref={container}>{error && <div className="graphics-error"><ShieldChevron size={34} /><h2>三维连接中断</h2><p>{error}</p><button className="primary-button" onClick={() => setAttempt(a => a + 1)}>重新连接<ArrowUpRight size={17} /></button></div>}</div>;
});

export default function App() {
  const [state, setState] = useState<GameSnapshot>(initialSnapshot);
  const [settings, setSettings] = useState<Settings>(readSettings);
  const [menu, setMenu] = useState<Menu>(null);
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const previousVolume = useRef(45);
  const savedRun = useRef('');
  const onReady = useCallback((next: GameEngine | null) => { engineRef.current = next; setEngine(next); if (next) setState(initialSnapshot()); }, []);
  const onSnapshot = useCallback((next: GameSnapshot) => setState(next), []);
  const fromGameMenu = useCallback((next: Menu) => { engineRef.current?.setMenuOpen(!!next); setMenu(next); }, []);
  const openMenu = useCallback((next: Menu) => { if (next === 'map') engineRef.current?.noteMapCheck(); engineRef.current?.pause(); engineRef.current?.setMenuOpen(!!next); setMenu(next); }, []);
  const closeMenu = useCallback(() => { engineRef.current?.setMenuOpen(false); setMenu(null); }, []);
  const updateSettings = useCallback((next: Settings) => {
    setSettings(next); engineRef.current?.setSettings(next);
    try { localStorage.setItem('panda-meridian-settings', JSON.stringify(next)); } catch { /* 无存储权限时仍可完整游戏。 */ }
  }, []);
  const mute = () => { if (settings.volume) previousVolume.current = settings.volume; updateSettings({ ...settings, volume: settings.volume ? 0 : previousVolume.current }); };
  const operation = () => { engineRef.current?.setMenuOpen(false); setMenu(null); };
  const debrief = state.phase === 'complete' || state.phase === 'failed';

  useEffect(() => {
    if (!debrief) return;
    const signature = `${state.elapsed}-${state.score}-${state.shots}`;
    if (savedRun.current === signature) return;
    savedRun.current = signature;
    try {
      const previous = JSON.parse(localStorage.getItem('panda-meridian-runs') ?? '[]');
      const runs = Array.isArray(previous) ? previous.slice(-4) : [];
      runs.push({ at: new Date().toISOString(), score: state.score, elapsed: state.elapsed, extracted: state.extracted, market: state.market, metrics: state.metrics, shots: state.shots, hits: state.hits, threats: state.threats, arrested: state.arrested, civilians: state.civilians, civilianLosses: state.civilianLosses, squad: state.squad });
      localStorage.setItem('panda-meridian-runs', JSON.stringify(runs));
    } catch { /* 报告仅在当前页面保留。 */ }
  }, [debrief, state]);

  return <main className={`app-shell ${state.phase === 'staging' ? 'at-staging' : ''}`}>
    <header className="app-header flex items-center justify-between">
      <button className="brand-mark panda-brand" aria-label="PandaAI 寂静子午线首页" onClick={operation}><PandaMark size={36} /><span><strong>panda<span>AI</span></strong><small>寂静子午线 · 交易人格实验室</small></span></button>
      <div className="header-divider" />
      <nav className="main-nav flex items-stretch" aria-label="主导航"><button className={!menu || menu === 'map' || menu === 'briefing' ? 'active' : ''} onClick={operation}><span className="nav-index">01</span> 行动测试</button><button className={menu === 'loadout' ? 'active' : ''} onClick={() => openMenu('loadout')}><span className="nav-index">02</span> 装备配置</button><button className={menu === 'method' ? 'active' : ''} onClick={() => openMenu('method')}><span className="nav-index">03</span> 评估方法<ArrowUpRight size={12} /></button></nav>
      <div className="header-right flex items-center"><span className="connection-label flex items-center gap-2"><span className="status-light" />{state.ready ? '行为记录已连接' : '正在建立场景'}</span><span className="header-divider" /><button className="commander-profile flex items-center gap-2.5" onClick={() => openMenu('briefing')} aria-label="打开行动简报"><span className="profile-icon"><ShieldChevron size={21} weight="light" /></span><span><strong>GUEST</strong><small>本地测试者</small></span></button><div className="header-tools flex items-center gap-1"><button className="icon-button sound-toggle" aria-label={settings.volume ? '静音' : '开启声音'} onClick={mute}>{settings.volume ? <SpeakerHigh size={18} weight="light" /> : <SpeakerSlash size={18} weight="light" />}</button>{state.phase === 'active' && <button className="icon-button" aria-label="暂停行动" onClick={() => engine?.pause()}><Pause size={18} /></button>}<button className={`icon-button ${menu === 'settings' ? 'selected' : ''}`} aria-label="打开设置" onClick={() => openMenu('settings')}><GearSix size={20} weight="light" /></button></div></div>
    </header>
    <div className="operation-stage"><GameViewport onReady={onReady} onSnapshot={onSnapshot} onMenu={fromGameMenu} settings={settings} /><HUD state={state} actions={engine} openMenu={openMenu} />{state.phase === 'active' && !menu && <TouchControls actions={engine} />}{state.phase === 'paused' && !menu && <PauseOverlay state={state} actions={engine} openMenu={openMenu} />}{debrief && !menu && <Debrief state={state} actions={engine} openMenu={openMenu} />}{menu && <MenuOverlay menu={menu} state={state} actions={engine} settings={settings} onSettings={updateSettings} close={closeMenu} />}{!state.ready && <div className="loading-status"><span className="loading-line" /><span>正在建立雨夜港口与虚拟市场</span></div>}</div>
  </main>;
}
