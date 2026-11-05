type Attrs = Record<string, string | number | boolean | undefined | ((e: Event) => void)>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'value') (el as HTMLInputElement).value = String(v);
    else if (k === 'checked') (el as HTMLInputElement).checked = Boolean(v);
    else if (k === 'selected') (el as HTMLOptionElement).selected = Boolean(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function select<T extends string | number>(
  options: { value: T; label: string }[], value: T, onChange: (v: string) => void, attrs: Attrs = {},
): HTMLSelectElement {
  return h('select', { ...attrs, onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value) },
    options.map((o) => h('option', { value: String(o.value), selected: String(o.value) === String(value) }, o.label)));
}

export function num(value: number | undefined, onInput: (v: number | undefined) => void, attrs: Attrs = {}): HTMLInputElement {
  return h('input', {
    type: 'number', inputmode: 'decimal', step: 'any', ...attrs,
    value: value === undefined || Number.isNaN(value) ? '' : value,
    oninput: (e: Event) => {
      const raw = (e.target as HTMLInputElement).value;
      onInput(raw === '' ? undefined : Number(raw));
    },
  });
}

export function fmtMeso(x: number): string {
  if (!Number.isFinite(x)) return '∞';
  if (x >= 1e12) return `${(x / 1e12).toFixed(2)}T`;
  if (x >= 1e9) return `${(x / 1e9).toFixed(x >= 1e11 ? 0 : x >= 1e10 ? 1 : 2)}B`;
  if (x >= 1e6) return `${(x / 1e6).toFixed(0)}M`;
  return `${Math.round(x).toLocaleString()}`;
}

export function iconUrl(iconId?: number | string): string | undefined {
  return iconId ? `${import.meta.env.BASE_URL}icons/${iconId}.png` : undefined;
}
