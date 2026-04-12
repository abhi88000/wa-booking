const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Format date string/Date to "14 Apr 2026" or "14 Apr" (short) */
export function fmtDate(val, short = false) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  const day = d.getDate();
  const mon = MONTHS[d.getMonth()];
  if (short) return `${day} ${mon}`;
  return `${day} ${mon} ${d.getFullYear()}`;
}

/** Format 24h time "14:30:00" to "2:30 PM" */
export function fmt12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${p}`;
}
