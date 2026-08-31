import React from 'react';

/**
 * Turn Gemini-style TeX (`$1.01^{365}$`, `$\rightarrow$`) into readable React
 * without pulling in KaTeX. Chat stays a static export for Capacitor/Tauri.
 */

const COMMANDS: Record<string, string> = {
  rightarrow: '→',
  leftarrow: '←',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  Leftarrow: '⇐',
  Leftrightarrow: '⇔',
  to: '→',
  times: '×',
  cdot: '·',
  ast: '*',
  div: '÷',
  pm: '±',
  mp: '∓',
  approx: '≈',
  neq: '≠',
  ne: '≠',
  leq: '≤',
  le: '≤',
  geq: '≥',
  ge: '≥',
  infty: '∞',
  ldots: '…',
  dots: '…',
  cdots: '⋯',
  circ: '∘',
  degree: '°',
  percent: '%',
  sim: '∼',
  equiv: '≡',
  propto: '∝',
  therefore: '∴',
  because: '∵',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  subseteq: '⊆',
  cap: '∩',
  cup: '∪',
  forall: '∀',
  exists: '∃',
  sum: '∑',
  prod: '∏',
  int: '∫',
  partial: '∂',
  nabla: '∇',
  ell: 'ℓ',
  hbar: 'ℏ',
  Re: 'Re',
  Im: 'Im',
  triangle: '△',
  angle: '∠',
  perp: '⊥',
  parallel: '∥',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω'
};

const STRIP_COMMANDS = new Set([
  'left',
  'right',
  'big',
  'Big',
  'bigg',
  'Bigg',
  'bigl',
  'bigr',
  'quad',
  'qquad',
  'hspace',
  'vspace'
]);

function isLikelyLatex(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  if (/[\\^{}]/.test(trimmed)) return true;
  if (/[_^=+\-*/<>]/.test(trimmed) && !/\b[A-Za-z]{4,}\b/.test(trimmed)) return true;
  return false;
}

function parseGroup(source: string, start: number): { body: string; next: number } {
  if (start >= source.length) return { body: '', next: start };
  if (source[start] === '{') {
    let depth = 0;
    for (let i = start; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) return { body: source.slice(start + 1, i), next: i + 1 };
      }
    }
    return { body: source.slice(start + 1), next: source.length };
  }
  if (source[start] === '\\') {
    const match = /^\\([A-Za-z]+|.)/.exec(source.slice(start));
    const raw = match ? match[0] : '\\';
    return { body: raw, next: start + raw.length };
  }
  return { body: source[start], next: start + 1 };
}

function renderLatex(math: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let buffer = '';
  let i = 0;

  const flush = () => {
    if (!buffer) return;
    nodes.push(buffer);
    buffer = '';
  };

  while (i < math.length) {
    const ch = math[i];

    if (ch === '\\') {
      const match = /^\\([A-Za-z]+|[,;:! ])/.exec(math.slice(i));
      if (!match) {
        buffer += ch;
        i += 1;
        continue;
      }
      const command = match[1];
      i += match[0].length;
      while (math[i] === ' ') i += 1;

      if (command === 'frac' || command === 'dfrac' || command === 'tfrac') {
        flush();
        const num = parseGroup(math, i);
        const den = parseGroup(math, num.next);
        i = den.next;
        nodes.push(
          <span key={`${keyPrefix}-f-${i}`} className="inline-flex flex-col items-center mx-0.5 align-middle leading-none">
            <span className="border-b border-current px-0.5 pb-px">{renderLatex(num.body, `${keyPrefix}-n-${i}`)}</span>
            <span className="px-0.5 pt-px">{renderLatex(den.body, `${keyPrefix}-d-${i}`)}</span>
          </span>
        );
        continue;
      }

      if (command === 'sqrt') {
        flush();
        const rad = parseGroup(math, i);
        i = rad.next;
        nodes.push(
          <span key={`${keyPrefix}-s-${i}`}>
            √{renderLatex(rad.body, `${keyPrefix}-r-${i}`)}
          </span>
        );
        continue;
      }

      if (command === 'text' || command === 'mathrm' || command === 'mathbf' || command === 'textit') {
        const group = parseGroup(math, i);
        i = group.next;
        buffer += group.body;
        continue;
      }

      if (STRIP_COMMANDS.has(command) || command === ',' || command === ';' || command === '!' || command === ':' || command === ' ') {
        continue;
      }

      const mapped = COMMANDS[command];
      if (mapped) {
        buffer += mapped;
        continue;
      }

      buffer += command;
      continue;
    }

    if (ch === '^' || ch === '_') {
      flush();
      const group = parseGroup(math, i + 1);
      i = group.next;
      const Tag = ch === '^' ? 'sup' : 'sub';
      nodes.push(
        <Tag key={`${keyPrefix}-${ch}-${i}`} className="text-[0.7em] leading-none">
          {renderLatex(group.body, `${keyPrefix}-${ch}-${i}`)}
        </Tag>
      );
      continue;
    }

    if (ch === '{' || ch === '}') {
      i += 1;
      continue;
    }

    if (ch === '~') {
      buffer += ' ';
      i += 1;
      continue;
    }

    buffer += ch;
    i += 1;
  }

  flush();
  return nodes;
}

export function splitAndRenderMath(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = pattern.exec(text)) !== null) {
    const inlineDollar = match[2] != null;
    const body = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';

    if (inlineDollar && !isLikelyLatex(body)) {
      pattern.lastIndex = match.index + 1;
      continue;
    }

    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }

    const display = match[1] != null || match[4] != null;
    parts.push(
      <span
        key={`${keyPrefix}-math-${idx}`}
        className={display ? 'block my-1 text-center font-medium' : 'font-medium'}
      >
        {renderLatex(body.trim(), `${keyPrefix}-math-${idx}`)}
      </span>
    );
    idx += 1;
    last = match.index + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? parts : [text];
}
