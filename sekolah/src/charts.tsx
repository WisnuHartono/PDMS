// Grafik SVG ringan untuk widget dashboard.

export function Donut({ value, total, color = 'var(--ok)', label }: { value: number; total: number; color?: string; label?: string }) {
  const pct = total ? value / total : 0
  const r = 42
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 110 110" className="donut" role="img" aria-label={`${Math.round(pct * 100)}%`}>
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--track)" strokeWidth="13" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="13" strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round" transform="rotate(-90 55 55)" />
      <text x="55" y="56" textAnchor="middle" className="donut-v">{Math.round(pct * 100)}%</text>
      {label && <text x="55" y="72" textAnchor="middle" className="donut-l">{label}</text>}
    </svg>
  )
}

export function MultiDonut({ parts }: { parts: { v: number; color: string; label: string }[] }) {
  const total = parts.reduce((a, b) => a + b.v, 0) || 1
  const r = 42
  const c = 2 * Math.PI * r
  let off = 0
  return (
    <svg viewBox="0 0 110 110" className="donut" role="img">
      <circle cx="55" cy="55" r={r} fill="none" stroke="var(--track)" strokeWidth="13" />
      {parts.map((p) => {
        const len = (p.v / total) * c
        const el = <circle key={p.label} cx="55" cy="55" r={r} fill="none" stroke={p.color} strokeWidth="13" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} transform="rotate(-90 55 55)" />
        off += len
        return el
      })}
    </svg>
  )
}

export function LineChart({ points, max, height = 150, suffix = '' }: { points: { x: string; y: number }[]; max?: number; height?: number; suffix?: string }) {
  const W = 320
  const H = height
  const pad = { l: 34, r: 10, t: 12, b: 26 }
  const m = max ?? Math.max(1, ...points.map((p) => p.y))
  const step = points.length > 1 ? (W - pad.l - pad.r) / (points.length - 1) : 0
  const xy = points.map((p, i) => [pad.l + i * step, pad.t + (1 - p.y / m) * (H - pad.t - pad.b)] as const)
  const path = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = xy.length ? `${path} L${xy[xy.length - 1][0]},${H - pad.b} L${xy[0][0]},${H - pad.b} Z` : ''
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {[0, 0.5, 1].map((f) => {
        const y = pad.t + (1 - f) * (H - pad.t - pad.b)
        return (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} className="grid" />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" className="axis">{Math.round(m * f)}{suffix}</text>
          </g>
        )
      })}
      <path d={area} className="area" />
      <path d={path} className="line" />
      {xy.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="3.2" className="dot"><title>{`${points[i].x}: ${points[i].y}${suffix}`}</title></circle>
          {(points.length <= 10 || i % Math.ceil(points.length / 8) === 0) && <text x={x} y={H - 8} textAnchor="middle" className="axis">{points[i].x}</text>}
        </g>
      ))}
    </svg>
  )
}

export function Bars({ data, height = 150 }: { data: { label: string; v: number; color?: string }[]; height?: number }) {
  const W = 320
  const H = height
  const pad = { l: 10, r: 10, t: 16, b: 26 }
  const m = Math.max(1, ...data.map((d) => d.v))
  const bw = (W - pad.l - pad.r) / Math.max(1, data.length)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="grid" />
      {data.map((d, i) => {
        const h = (d.v / m) * (H - pad.t - pad.b)
        const x = pad.l + i * bw + bw * 0.2
        return (
          <g key={d.label}>
            <rect x={x} y={H - pad.b - h} width={bw * 0.6} height={h} rx="3" fill={d.color ?? 'var(--accent)'} />
            <text x={x + bw * 0.3} y={H - pad.b - h - 4} textAnchor="middle" className="axis strong">{d.v}</text>
            <text x={x + bw * 0.3} y={H - 8} textAnchor="middle" className="axis">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function Meter({ pct, color }: { pct: number; color?: string }) {
  return (
    <div className="meter"><div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></div>
  )
}
