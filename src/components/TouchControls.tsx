import { useRef } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Crosshair, HandPalm, Lightning } from '@phosphor-icons/react';
import type { GameActions } from '../game/types';

export function TouchControls({ actions }: { actions: GameActions | null }) {
  const previous = useRef({ x: 0, y: 0 });
  return <div className="touch-controls">
    <div className="touch-look" aria-label="Drag to look" onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); previous.current = { x: event.clientX, y: event.clientY }; }} onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; actions?.look((event.clientX - previous.current.x) * 1.8, (event.clientY - previous.current.y) * 1.8); previous.current = { x: event.clientX, y: event.clientY }; }} />
    <div className="touch-dpad">{[['KeyW', 'Move forward', ArrowUp], ['KeyA', 'Move left', ArrowLeft], ['KeyS', 'Move backward', ArrowDown], ['KeyD', 'Move right', ArrowRight]].map(([key, label, Icon]) => { const Component = Icon as typeof ArrowUp; return <button key={key as string} className={key as string} aria-label={label as string} onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); actions?.input(key as string, true); }} onPointerUp={() => actions?.input(key as string, false)} onPointerCancel={() => actions?.input(key as string, false)} onLostPointerCapture={() => actions?.input(key as string, false)}><Component size={20} /></button>; })}<button className="touch-crouch" aria-label="Toggle crouch" onClick={() => actions?.toggleCrouch()}>C</button></div>
    <div className="touch-actions"><button className="touch-fire" aria-label="Fire weapon" onPointerDown={e => { e.preventDefault(); actions?.shoot(); }}><Crosshair size={28} /></button><button aria-label="Interact" onClick={() => actions?.interact()}>E</button><button aria-label="Call for compliance" onClick={() => actions?.shout()}><HandPalm size={21} /></button><button aria-label="Reload weapon" onClick={() => actions?.reload()}>R</button></div>
  </div>;
}
