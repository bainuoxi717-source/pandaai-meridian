import type { WeaponId } from '../game/types';

export function GunSilhouette({ weapon = 'stillwater', detailed = false }: { weapon?: WeaponId; detailed?: boolean }) {
  return (
    <svg viewBox="0 0 410 130" className={`gun-silhouette ${detailed ? 'detailed' : ''}`} role="img" aria-label={weapon === 'stillwater' ? 'STILLWATER Survey carbine' : weapon === 'quietline' ? 'QUIETLINE-9 submachine gun' : 'COPPERFAN less-lethal shotgun'}>
      {weapon === 'stillwater' && <>
      <g fill="currentColor">
        <path d="M21 38H53L96 44H174V65H99L60 57V83H23Z" opacity=".75" />
        <path d="M28 41H35V80H28ZM56 48L86 52V57H55Z" opacity=".4" />
        <path d="M101 46H187V72H171L164 87H142L137 73H122L116 100H102L105 77L99 69Z" />
        <path d="M155 72H178L184 108L175 112H155Z" opacity=".85" />
        <path d="M183 46H293V67H182Z" />
        <path d="M287 51H347V61H287ZM344 48H388V64H344Z" opacity=".85" />
        <path d="M96 39H289V47H96ZM131 25H159V40H151V32H139V40H131Z" />
        <path d="M182 65H202V88H191L184 75Z" opacity=".7" />
        <path d="M255 66H285V74H256Z" opacity=".6" />
        <path d="M310 43H317V51H309Z" />
      </g>
      <g stroke="var(--silhouette-detail, #252931)" fill="none" strokeWidth="2">
        <path d="M114 53H146V63H114ZM147 73V82H162L166 72" />
        {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${198 + i * 11} 51V59`} />)}
        {Array.from({ length: 20 }, (_, i) => <path key={i} d={`M${103 + i * 9} 39V43`} />)}
        <path d="M161 78V103M168 78L174 103M28 51H47V67H28" />
      </g>
      </>}
      {weapon === 'quietline' && <>
        <g fill="currentColor">
          <path d="M28 35H40V87H28ZM40 48H116V55H40ZM40 68H112V73H40Z" opacity=".7" />
          <path d="M111 42H217Q228 43 230 53V66H163L149 76H122L112 68Z" />
          <path d="M134 64H158L153 79L143 99H125L134 72ZM170 66H188Q185 86 198 108L183 117Q167 93 170 66Z" opacity=".9" />
          <path d="M214 45H278L286 64L280 73H212Z" opacity=".8" />
          <path d="M277 48H311V58H278ZM307 44H377Q384 50 377 63H307Z" />
          <path d="M155 34H198V42H155ZM165 25H185V35H180V30H171V35H165ZM277 34H283V46H277Z" opacity=".75" />
        </g>
        <g stroke="var(--silhouette-detail, #252931)" fill="none" strokeWidth="2">
          <path d="M119 49H172V58H119ZM158 69L154 79H170M177 75Q177 94 190 111M282 50V64M317 47V60M33 39V83" />
          {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${224 + i * 8} 50V66`} />)}
          <path d="M179 52H197M184 56H199" />
        </g>
      </>}
      {weapon === 'beanbag' && <>
        <g fill="currentColor">
          <path d="M25 49L78 44L128 60L155 56V77H124L90 67L43 99H25Z" opacity=".86" />
          <path d="M133 43H220V67H166L157 78H141L137 66Z" />
          <path d="M211 43H385V51H211ZM211 59H329V67H211Z" />
          <path d="M218 53H284L291 61L284 78H217L210 66Z" opacity=".8" />
          <path d="M139 43H208V39H139ZM366 38H374V44H366ZM24 48H31V100H24Z" opacity=".65" />
        </g>
        <g stroke="var(--silhouette-detail, #252931)" fill="none" strokeWidth="2">
          <path d="M154 49H201V59H154ZM163 67L160 77H178L183 66M145 70L140 78M33 55V89M46 57L81 53M291 61H320M374 46H385" />
          {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${222 + i * 8} 57V73`} />)}
        </g>
      </>}
    </svg>
  );
}
