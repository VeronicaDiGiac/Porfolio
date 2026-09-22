/* PF ARCHIVIO TECNOLOGICO — mascotte
   Solo il markup SVG del personaggio: nessuna logica di animazione qui.
   Sostituibile in futuro con uno sprite sheet senza toccare assistant.js. */

export function createAssistantSvg() {
  return `
    <svg
      class="assistant-svg"
      viewBox="0 0 120 150"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse id="shadow" cx="60" cy="140" rx="36" ry="7" fill="var(--ink)" opacity="0.16" />

      <g id="arms">
        <path id="arm-left" d="M14,74 Q-8,82 0,106" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" />
        <path id="arm-right" d="M106,74 Q128,82 120,106" fill="none" stroke="var(--ink)" stroke-width="5" stroke-linecap="round" />
      </g>

      <g id="body">
        <rect x="8" y="38" width="104" height="92" rx="6" fill="var(--plastic)" stroke="var(--ink)" stroke-width="2.5" />
        <path d="M8,44 L8,38 Q8,38 14,38 L26,50 L8,50 Z" fill="var(--paper)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round" />

        <g id="shutter">
          <rect x="23" y="52" width="74" height="48" rx="4" fill="var(--ink-soft)" stroke="var(--ink)" stroke-width="2" />

          <g id="brow-left">
            <rect x="32" y="61" width="19" height="4" rx="2" fill="var(--ink)" />
          </g>
          <g id="brow-right">
            <rect x="69" y="61" width="19" height="4" rx="2" fill="var(--ink)" />
          </g>

          <g id="eye-left">
            <ellipse cx="44" cy="78" rx="11" ry="13" fill="var(--paper)" stroke="var(--ink)" stroke-width="2" />
            <circle id="pupil-left" cx="44" cy="78" r="5" fill="var(--ink)" />
          </g>
          <g id="eye-right">
            <ellipse cx="76" cy="78" rx="11" ry="13" fill="var(--paper)" stroke="var(--ink)" stroke-width="2" />
            <circle id="pupil-right" cx="76" cy="78" r="5" fill="var(--ink)" />
          </g>
        </g>

        <rect x="30" y="108" width="60" height="15" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.5" />
        <rect x="34" y="112" width="34" height="2.5" fill="var(--ink-soft)" />
        <rect x="34" y="117" width="22" height="2" fill="var(--ink-soft)" />
      </g>

      <g id="zzz" class="assistant-zzz" aria-hidden="true">
        <text x="88" y="34" font-family="var(--font-mono)" font-weight="700" font-size="14" fill="var(--signal-red)">Z</text>
        <text x="98" y="22" font-family="var(--font-mono)" font-weight="700" font-size="10" fill="var(--signal-red)">Z</text>
        <text x="105" y="12" font-family="var(--font-mono)" font-weight="700" font-size="7" fill="var(--signal-red)">Z</text>
      </g>
    </svg>
  `;
}
