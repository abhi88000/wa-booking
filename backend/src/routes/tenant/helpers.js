// Shared helpers for tenant routes

function formatTime12(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.toString().split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${(m || 0).toString().padStart(2, '0')} ${period}`;
}

function formatDateDD(dateVal) {
  if (!dateVal) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(dateVal);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

module.exports = { formatTime12, formatDateDD };
