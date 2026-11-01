// Ikon garis sederhana (SVG inline, tanpa dependensi).
import type { ReactNode } from 'react'

const P: Record<string, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  siswa: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.7 2.5 3 5.2" /></>,
  guru: <><circle cx="8" cy="7" r="3" /><path d="M2.5 20c.6-3.4 2.8-5.2 5.5-5.2 1.4 0 2.6.4 3.6 1.3" /><rect x="13" y="4" width="8.5" height="7" rx="1" /><path d="M15 15h6M18 11v4" /></>,
  induk: <><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z" /><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3" /><path d="M8 7h7M8 10.5h5" /></>,
  rombel: <><path d="M12 3 2.5 8 12 13l9.5-5z" /><path d="m2.5 12.5 9.5 5 9.5-5" /><path d="m2.5 16.5 9.5 5 9.5-5" /></>,
  mapel: <><path d="M2.5 5c3-1.3 6.3-1.3 9.5.8v14c-3.2-2-6.5-2-9.5-.7z" /><path d="M21.5 5c-3-1.3-6.3-1.3-9.5.8v14c3.2-2 6.5-2 9.5-.7z" /></>,
  absensi: <><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><path d="m8.5 15 2.5 2.5 4.5-4.5" /></>,
  absenPegawai: <><rect x="3" y="4.5" width="18" height="16.5" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><circle cx="12" cy="14" r="2" /><path d="M8.5 19c.6-1.4 1.9-2.2 3.5-2.2s2.9.8 3.5 2.2" /></>,
  nilai: <><rect x="5" y="3.5" width="14" height="18" rx="2" /><path d="M9 3.5V2h6v1.5" /><path d="M8.5 10h7M8.5 14h7M8.5 18h4" /></>,
  rapor: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></>,
  ekskul: <><circle cx="12" cy="12" r="9" /><path d="M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9M12 3c-2.5 2.5-3.8 5.5-3.8 9s1.3 6.5 3.8 9M3.5 9h17M3.5 15h17" /></>,
  pengaturan: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01" /></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  more: <><circle cx="12" cy="5" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="12" cy="19" r="1.3" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  print: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></>,
  download: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 20h16" /></>,
  upload: <><path d="M12 20V9M7 14l5-5 5 5" /><path d="M4 4h16" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  chevL: <path d="m15 6-6 6 6 6" />,
  chevR: <path d="m9 6 6 6-6 6" />,
  prasarana: <><path d="M3 21h18" /><path d="M5 21V8l7-4 7 4v13" /><path d="M9 21v-5h6v5" /><path d="M9 10h.01M15 10h.01M9 13h.01M15 13h.01" /></>,
  kunci: <><rect x="4" y="10.5" width="16" height="10.5" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /><path d="M12 15v2.5" /></>,
  school: <><path d="M3 10 12 5l9 5-9 5z" /><path d="M7 12.5V17c1.5 1.3 3.2 2 5 2s3.5-.7 5-2v-4.5" /><path d="M21 10v5" /></>,
}

export type IconName = keyof typeof P

export function Icon({ name, size = 20, className }: { name: IconName | string; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {P[name] ?? P.dashboard}
    </svg>
  )
}
