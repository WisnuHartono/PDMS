import type { Settings, StatusDef } from './types'

// Status yang boleh dipakai untuk suatu jenis dokumen (kosong / tidak diatur = semua status).
export function allowedStatuses(s: Settings, category: string): StatusDef[] {
  const rule = s.categoryStatuses?.[category]
  if (!rule || rule.length === 0) return s.statuses
  const list = s.statuses.filter((x) => rule.includes(x.code))
  return list.length ? list : s.statuses
}
