import { useState, useEffect } from 'react';
import api from '../api';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Singapore', 'Asia/Tokyo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Australia/Sydney', 'Pacific/Auckland', 'Africa/Nairobi', 'UTC'
];

function getNext10Dates() {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 10; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i + 1);
    dates.push({
      dateStr: d.toISOString().split('T')[0],
      dayName: DAY_MAP[d.getDay()],
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    });
  }
  return dates;
}

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editingAvail, setEditingAvail] = useState(null);
  const [filter, setFilter] = useState('active');
  const [form, setForm] = useState({ name: '', specialization: '', phone: '', email: '', consultationFee: 0, slotDuration: 20 });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.getDoctors();
      setDoctors(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditingDoc(null);
    setForm({ name: '', specialization: '', phone: '', email: '', consultationFee: 0, slotDuration: 20 });
    setShowAdd(true);
  };

  const openEdit = (doc) => {
    setEditingDoc(doc);
    setForm({
      name: doc.name, specialization: doc.specialization || '',
      phone: doc.phone || '', email: doc.email || '',
      consultationFee: Number(doc.consultation_fee) || 0,
      slotDuration: doc.slot_duration || 20
    });
    setShowAdd(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDoc) {
        await api.updateDoctor(editingDoc.id, form);
      } else {
        await api.addDoctor(form);
      }
      setShowAdd(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Remove "${doc.name}"? This will cancel all their future appointments.`)) return;
    try {
      await api.deleteDoctor(doc.id);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
  };

  const toggleActive = async (doc) => {
    await api.updateDoctor(doc.id, { isActive: !doc.is_active });
    load();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Doctors</h1>
        <div className="flex gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          <button onClick={openAdd}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-900">
            + Add Doctor
          </button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editingDoc ? 'Edit Doctor' : 'Add Doctor'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" required />
              <input placeholder="Specialization" value={form.specialization} onChange={e => setForm({...form, specialization: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" />
                <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Fee</label>
                  <input type="number" value={form.consultationFee} onChange={e => setForm({...form, consultationFee: parseInt(e.target.value)})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Slot Duration (min)</label>
                  <input type="number" value={form.slotDuration} onChange={e => setForm({...form, slotDuration: parseInt(e.target.value)})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                <button type="submit" className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm">
                  {editingDoc ? 'Save Changes' : 'Add Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Availability Editor Modal */}
      {editingAvail && (
        <AvailabilityEditor doctorId={editingAvail.id} doctorName={editingAvail.name}
          onClose={() => { setEditingAvail(null); load(); }} />
      )}

      {/* Doctor Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="text-gray-500 col-span-3 text-center py-10">Loading...</div> :
          doctors.filter(doc => filter === 'all' ? true : filter === 'active' ? doc.is_active : !doc.is_active).length === 0 ? (
            <div className="text-gray-400 col-span-3 text-center py-10 text-sm">No {filter} doctors found</div>
          ) :
          doctors.filter(doc => filter === 'all' ? true : filter === 'active' ? doc.is_active : !doc.is_active).map(doc => (
            <div key={doc.id} className={`bg-white rounded-xl shadow-sm p-5 border ${!doc.is_active ? 'opacity-50' : ''}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-gray-900">{doc.name}</h3>
                  <p className="text-sm text-gray-500">{doc.specialization || 'General'}</p>
                </div>
                <button onClick={() => toggleActive(doc)}
                  className={`text-xs px-2 py-1 rounded ${doc.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {doc.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
              <div className="mt-3 space-y-1 text-sm text-gray-500">
                {doc.consultation_fee > 0 && <p>Fee: ₹{doc.consultation_fee}</p>}
                <p>Slot: {doc.slot_duration} min</p>
                {doc.phone && <p>{doc.phone}</p>}
              </div>
              {doc.availability && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-1">Schedule:</p>
                  <div className="flex flex-wrap gap-1">
                    {doc.availability.filter(Boolean).map((a, i) => (
                      <span key={i} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded capitalize">
                        {a.day?.substring(0, 3)} {a.start_time?.substring(0,5)}-{a.end_time?.substring(0,5)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => setEditingAvail(doc)}
                className="mt-4 w-full text-center text-sm text-slate-700 border border-slate-300 rounded-lg py-2 hover:bg-slate-100">
                Manage Schedule
              </button>
              <div className="flex gap-2 mt-2">
                <button onClick={() => openEdit(doc)}
                  className="flex-1 text-center text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50">
                  Edit
                </button>
                <button onClick={() => handleDelete(doc)}
                  className="flex-1 text-center text-xs text-red-500 border border-red-200 rounded-lg py-1.5 hover:bg-red-50">
                  Remove
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function AvailabilityEditor({ doctorId, doctorName, onClose }) {
  const next10 = getNext10Dates();
  const [schedule, setSchedule] = useState(
    DAYS.map(day => ({ day, enabled: false, startTime: '10:00', endTime: '16:00' }))
  );
  const [breaks, setBreaks] = useState([{ startTime: '13:00', endTime: '14:00', reason: 'Lunch' }]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [slotDuration, setSlotDuration] = useState(20);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getDoctorAvailability(doctorId).then(({ data }) => {
      setSlotDuration(data.slotDuration || 20);
      setTimezone(data.timezone || 'Asia/Kolkata');
      if (data.availability.length > 0) {
        setSchedule(DAYS.map(day => {
          const match = data.availability.find(a => a.day === day);
          return match
            ? { day, enabled: true, startTime: match.start_time.substring(0, 5), endTime: match.end_time.substring(0, 5) }
            : { day, enabled: false, startTime: '10:00', endTime: '16:00' };
        }));
      }
      if (data.breaks) {
        const dailyBreaks = data.breaks.filter(b => !b.break_date);
        const dateBreaks = data.breaks.filter(b => b.break_date && b.is_full_day);
        if (dailyBreaks.length > 0) {
          setBreaks(dailyBreaks.map(b => ({
            startTime: b.start_time.substring(0, 5),
            endTime: b.end_time.substring(0, 5),
            reason: b.reason || 'Break'
          })));
        }
        setBlockedDates(dateBreaks.map(b => b.break_date.substring(0, 10)));
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [doctorId]);

  const toggleDay = (idx) => {
    const s = [...schedule];
    s[idx].enabled = !s[idx].enabled;
    setSchedule(s);
  };

  const updateDay = (idx, field, value) => {
    const s = [...schedule];
    s[idx][field] = value;
    setSchedule(s);
  };

  const addBreak = () => setBreaks([...breaks, { startTime: '13:00', endTime: '13:30', reason: '' }]);
  const removeBreak = (idx) => setBreaks(breaks.filter((_, i) => i !== idx));

  const toggleBlockDate = (dateStr) => {
    setBlockedDates(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const isDateAvailable = (dateInfo) => {
    if (blockedDates.includes(dateInfo.dateStr)) return false;
    const daySchedule = schedule.find(s => s.day === dateInfo.dayName);
    return daySchedule?.enabled || false;
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateDoctorAvailability(doctorId, {
        slotDuration,
        timezone,
        availability: schedule.filter(s => s.enabled).map(s => ({
          day: s.day, startTime: s.startTime, endTime: s.endTime
        })),
        breaks: [
          ...breaks.filter(b => b.startTime && b.endTime).map(b => ({
            startTime: b.startTime, endTime: b.endTime, reason: b.reason
          })),
          ...blockedDates.map(d => ({
            breakDate: d, isFullDay: true, reason: 'Day off'
          }))
        ]
      });
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  if (!loaded) return null;

  const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4 py-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-xl my-auto">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{doctorName} — Schedule</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Timezone + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400">
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Slot Duration</label>
              <select value={slotDuration} onChange={e => setSlotDuration(parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400">
                {[10, 15, 20, 30, 45, 60].map(v => <option key={v} value={v}>{v} min</option>)}
              </select>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button type="button" onClick={() => {
              // Clone: enable weekdays Mon-Sat with same times, clear blocks
              const first = schedule.find(s => s.enabled);
              const time = first || { startTime: '10:00', endTime: '17:00' };
              setSchedule(DAYS.map(day => ({
                day, enabled: day !== 'sunday',
                startTime: time.startTime, endTime: time.endTime
              })));
              setBlockedDates([]);
            }}
              className="flex-1 text-xs border border-slate-300 text-slate-700 rounded-lg py-2 hover:bg-slate-100">
              Clone Last Schedule
            </button>
            <button type="button" onClick={() => {
              setSchedule(DAYS.map(day => ({ day, enabled: false, startTime: '10:00', endTime: '16:00' })));
              setBlockedDates([]);
            }}
              className="flex-1 text-xs border border-gray-200 text-gray-500 rounded-lg py-2 hover:bg-gray-50">
              Clear All
            </button>
          </div>

          {/* Weekly Base Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Weekly Base Schedule</label>
            <div className="space-y-2">
              {schedule.map((s, i) => (
                <div key={s.day} className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleDay(i)}
                    className={`w-12 text-xs py-1.5 rounded font-medium flex-shrink-0 ${s.enabled ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {DAY_LABELS[s.day]}
                  </button>
                  {s.enabled ? (
                    <>
                      <input type="time" value={s.startTime} onChange={e => updateDay(i, 'startTime', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1 outline-none" />
                      <span className="text-gray-400 text-xs">to</span>
                      <input type="time" value={s.endTime} onChange={e => updateDay(i, 'endTime', e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1 outline-none" />
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 ml-2">Off</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Daily Breaks */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">Daily Breaks</label>
              <button onClick={addBreak} className="text-slate-700 text-xs hover:underline">+ Add</button>
            </div>
            <div className="space-y-2">
              {breaks.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="time" value={b.startTime} onChange={e => {
                    const br = [...breaks]; br[i].startTime = e.target.value; setBreaks(br);
                  }} className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1 outline-none" />
                  <span className="text-gray-400 text-xs">to</span>
                  <input type="time" value={b.endTime} onChange={e => {
                    const br = [...breaks]; br[i].endTime = e.target.value; setBreaks(br);
                  }} className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1 outline-none" />
                  <input placeholder="Reason" value={b.reason} onChange={e => {
                    const br = [...breaks]; br[i].reason = e.target.value; setBreaks(br);
                  }} className="border border-gray-300 rounded px-2 py-1.5 text-sm w-24 outline-none" />
                  <button onClick={() => removeBreak(i)} className="text-red-400 hover:text-red-600 text-sm flex-shrink-0">x</button>
                </div>
              ))}
            </div>
          </div>

          {/* Next 10 Days — Date View */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Next 10 Days</label>
            <p className="text-xs text-gray-400 mb-3">Green = available (from weekly schedule). Click a date to block/unblock it.</p>
            <div className="grid grid-cols-2 gap-2">
              {next10.map(d => {
                const available = isDateAvailable(d);
                const blocked = blockedDates.includes(d.dateStr);
                const daySchedule = schedule.find(s => s.day === d.dayName);
                return (
                  <button key={d.dateStr} type="button" onClick={() => toggleBlockDate(d.dateStr)}
                    className={`p-3 rounded-lg border text-left transition ${
                      blocked
                        ? 'bg-red-50 border-red-200 text-red-600'
                        : available
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{d.label}</span>
                      {blocked && <span className="text-[10px] bg-red-100 px-1.5 py-0.5 rounded">Blocked</span>}
                    </div>
                    {available && !blocked && daySchedule?.enabled && (
                      <p className="text-xs mt-0.5 opacity-75">
                        {daySchedule.startTime} — {daySchedule.endTime}
                      </p>
                    )}
                    {!available && !blocked && (
                      <p className="text-xs mt-0.5">No schedule</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slot Preview */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 mb-1">Preview</p>
            <p className="text-sm text-gray-700">
              {(() => {
                const enabled = schedule.filter(s => s.enabled);
                if (enabled.length === 0) return 'No days enabled';
                const s = enabled[0];
                const start = parseInt(s.startTime.split(':')[0]) * 60 + parseInt(s.startTime.split(':')[1]);
                const end = parseInt(s.endTime.split(':')[0]) * 60 + parseInt(s.endTime.split(':')[1]);
                let breakMins = 0;
                breaks.forEach(b => {
                  const bs = parseInt(b.startTime.split(':')[0]) * 60 + parseInt(b.startTime.split(':')[1]);
                  const be = parseInt(b.endTime.split(':')[0]) * 60 + parseInt(b.endTime.split(':')[1]);
                  if (bs >= start && be <= end) breakMins += (be - bs);
                });
                const totalSlots = Math.floor((end - start - breakMins) / slotDuration);
                const availDays = next10.filter(d => isDateAvailable(d)).length;
                return `~${totalSlots} slots/day, ${enabled.length} days/week, ${availDays} of next 10 days open (${timezone})`;
              })()}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end p-5 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
          <button onClick={save} disabled={saving}
            className="bg-slate-800 text-white px-6 py-2 rounded-lg text-sm hover:bg-slate-900 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
