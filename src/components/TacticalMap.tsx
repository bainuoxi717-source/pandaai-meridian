import { memo } from 'react';
import type { GameSnapshot } from '../game/types';

export const TacticalMap = memo(function TacticalMap({ state, large = false }: { state: GameSnapshot; large?: boolean }) {
  const mapX = (x: number) => (x + 17.5) / 35 * 220 + 5;
  const mapY = (z: number) => (z + 38) / 63 * 232 + 7;
  const px = mapX(state.x), py = mapY(state.z);
  const gridId = large ? 'map-grid-large' : 'map-grid-small';
  const routeId = large ? 'map-route-large' : 'map-route-small';
  return (
    <svg className={`tactical-map ${large ? 'large' : ''}`} viewBox="0 0 230 250" role="img" aria-label="显示玩家、小队、仓库、威胁与入口的实时战术地图">
      <defs>
        <pattern id={gridId} width="16" height="16" patternUnits="userSpaceOnUse"><path d="M 16 0 L 0 0 0 16" fill="none" stroke="currentColor" strokeWidth=".4" opacity=".12" /></pattern>
        <pattern id={routeId} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line y2="5" stroke="#788579" strokeWidth="1" opacity=".15" /></pattern>
      </defs>
      <rect width="230" height="250" fill={`url(#${gridId})`} />
      <g fill="#272c35" stroke="#585c64" strokeWidth=".7">
        <path d="M10 30 H78 V225 H10 Z" />
        <path d="M171 36 H222 V222 H171 V183 H168 V93 H171Z" />
        <path d="M79 12 H168 V83 H123 V76 H103 V83 H79Z" />
        <path d="M81 44 H121 V50 H140 V44 H166" fill="none" strokeWidth="1.3" />
        <path d="M105 84 H121" stroke="#7c94bc" strokeWidth="2" strokeDasharray={state.doorOpen ? '3 3' : '0'} />
      </g>
      <g fill={`url(#${routeId})`} stroke="#4b515c" strokeWidth=".6">
        <rect x="139" y="148" width="18" height="37" />
        <rect x="146" y="91" width="17" height="26" />
        <rect x="82" y="114" width="9" height="17" />
        <rect x="131" y="133" width="12" height="14" />
      </g>
      <g fill="none" stroke="#4f5663" strokeWidth=".6" opacity=".7">
        <path d="M82 86 V229 H162 V191" />
        <path d="M112 91 V215" strokeDasharray="4 5" />
        <path d="M168 190 H217 M168 199 H217 M168 209 H217" />
        <path d="M10 101 H78 M10 151 H78 M10 198 H78" />
      </g>
      <g className="map-labels" fill="#828790" fontSize="5.5" textAnchor="middle">
        <text x="124" y="30">调度室</text><text x="123" y="67">仓库 03</text>
        <text x="45" y="127" transform="rotate(-90 45 127)">货物储藏区</text>
        <text x="195" y="126" transform="rotate(-90 195 126)">装卸码头 04</text>
        <text x="121" y="239">进入 / 撤离点</text>
      </g>
      <g opacity=".7" fill="none" stroke="#7b889d" strokeWidth=".8">
        <circle cx={mapX(.7)} cy={mapY(20)} r="9" strokeDasharray="2 3" />
      </g>
      {!state.evidence && <g transform={`translate(${mapX(-4.2)},${mapY(-33.1)})`}><rect x="-2" y="-2.6" width="4" height="5.2" fill="#889ec2" /><path d="M-1 -1H1M-1 .5H1" stroke="#262c37" strokeWidth=".6" /></g>}
      <g transform={`translate(${mapX(0)},${mapY(-16)})`}>
        <rect x="-3" y="-3" width="6" height="6" transform="rotate(45)" fill="none" stroke="#7a92bb" strokeWidth="1" />
        {!state.doorOpen && <circle r="8" fill="none" stroke="#7a92bb" strokeWidth=".5" opacity=".4" />}
      </g>
      {state.enemies.filter(e => e.visible && e.state !== 'down' && e.state !== 'secured').map(e => <circle key={e.id} cx={mapX(e.x)} cy={mapY(e.z)} r="2.1" fill={e.state === 'surrendered' ? '#8198be' : '#c07a65'} />)}
      {state.squad.filter(s => s.health > 0).map(s => (
        <g key={s.id} transform={`translate(${mapX(s.x)},${mapY(s.z)})`}>
          <circle r="2.5" fill="#8692a7" stroke="#2b3039" strokeWidth="1" />
          {large && <text x="5" y="1.5" fontSize="4.4" fill="#9ca6b6">{s.id}</text>}
        </g>
      ))}
      <g transform={`translate(${px},${py}) rotate(${state.heading})`}>
        <path d="M0 0L-16 -31Q0 -38 16 -31Z" fill="#859bc0" opacity=".1" />
        <path d="M0 -5L3.8 3L0 1.5L-3.8 3Z" fill="#a4b2ca" stroke="#24282e" strokeWidth=".6" />
      </g>
      <g transform="translate(209,15)" fill="#a4abb6" textAnchor="middle"><text fontSize="6">N</text><path d="M0 4L-2.2 9H2.2Z" /></g>
      <path d="M12 236V240H38V236" fill="none" stroke="#868c97" strokeWidth=".7" />
      <text x="25" y="233" fill="#868c97" textAnchor="middle" fontSize="4.6">10 M</text>
    </svg>
  );
});
