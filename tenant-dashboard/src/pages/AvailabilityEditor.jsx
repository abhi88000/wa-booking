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

export default function AvailabilityEditor({ doctorId, doctorName, doctorClinics, onClose }) {
  const [schedule, setSchedule] = useState(
    DAYS.map(day => ({ day, enabled: false, startTime: '10:00', endTime: '16:00' }))
  );
  const [selectedClinic, setSelectedClinic] = useState(
    doctorClinics?.length === 1 ? doctorClinics[0] : null
  );
  const [breaks, setBreaks] = useState([{ startTime: '13:00', endTime: '14:00', reason: 'Lunch' }]);
  const [blockedDates, setBlockedDates] = useState([]);
  const [slotDuration, setSlotDuration] = useState(20);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [repeating, setRepeating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    api.getDoctorAvailability(doctorId, selectedClinic).then(({ data }) => {
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
  }, [doctorId, selectedClinic]);

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
      let allBlockedDates = [...blockedDates];
      if (!repeating) {
        const today = new Date();
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
        const enabledDays = schedule.filter(s => s.enabled).map(s => s.day);
        for (let i = 1; i <= 28; i++) {
          const d = new Date(endOfWeek);
          d.setDate(endOfWeek.getDate() + i);
          const dayName = DAY_MAP[d.getDay()];
          if (enabledDays.includes(dayName)) {
            const ds = d.toISOString().split('T')[0];
            if (!allBlockedDates.includes(ds)) allBlockedDates.push(ds);
          }
        }
      }
      await api.updateDoctorAvailability(doctorId, {
        slotDuration,
        timezone,
        clinicLabel: selectedClinic || undefined,
        availability: schedule.filter(s => s.enabled).map(s => ({
          day: s.day, startTime: s.startTime, endTime: s.endTime
        })),
        breaks: [
          ...breaks.filter(b => b.startTime && b.endTime).map(b => ({
            startTime: b.startTime, endTime: b.endTime, reason: b.reason
          })),
          ...allBlockedDates.map(d => ({
            breakDate: d, isFullDay: true, reason: repeating ? 'Day off' : 'Non-repeating schedule'
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4 py-4 overflow-y-auto">
      <div className="bg-white rounded-lg w-full max-w-xl my-auto">
        <div className="flex justify-between items-center p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{doctorName} — Schedule</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">

          {doctorClinics && doctorClinics.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Schedule for Clinic</label>
              <div className="flex flex-wrap gap-2">
                {doctorClinics.map(cl => (
                  <button key={cl} type="button" onClick={() => setSelectedClinic(cl)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${
                      selectedClinic === cl 
                        ? 'bg-slate-800 text-white border-slate-800' 
                        : 'bg-white text-gray-600 border-gray-200 hover:border-slate-400'
                    }`}>
                    {cl}
                  </button>
                ))}
              </div>
              {!selectedClinic && <p className="text-[11px] text-amber-600 mt-1">Please select a clinic to set its schedule</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400">
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Slot Duration</label>
              <select value={slotDuration} onChange={e => setSlotDuration(parseInt(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-slate-400">
                {[10, 15, 20, 30, 45, 60].map(v => <option key={v} value={v}>{v} min</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => {
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

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Weekly Schedule</label>
              <button type="button" onClick={() => setRepeating(!repeating)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition ${
                  repeating ? 'bg-green-50 border-green-200 text-green-700' : 'bg-orange-50 border-orange-200 text-orange-700'
                }`}>
                <span className={`w-2 h-2 rounded-full ${repeating ? 'bg-green-500' : 'bg-orange-500'}`}></span>
                {repeating ? 'Repeats every week' : 'This week only'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-2">
              {repeating
                ? 'This schedule repeats every week. Block specific dates below for holidays.'
                : 'Schedule applies only to this week. You\'ll need to set it again next week.'}
            </p>
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
                        className="border border-gray-200 rounded px-2 py-1.5 text-sm flex-1 outline-none" />
                      <span className="text-gray-400 text-xs">to</span>
                      <input type="time" value={s.endTime} onChange={e => updateDay(i, 'endTime', e.target.value)}
                        className="border border-gray-200 rounded px-2 py-1.5 text-sm flex-1 outline-none" />
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 ml-2">Off</span>
                  )}
                </div>
              ))}
            </div>
          </div>

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
                  }} className="border border-gray-200 rounded px-2 py-1.5 text-sm flex-1 outline-none" />
                  <span className="text-gray-400 text-xs">to</span>
                  <input type="time" value={b.endTime} onChange={e => {
                    const br = [...breaks]; br[i].endTime = e.target.value; setBreaks(br);
                  }} className="border border-gray-200 rounded px-2 py-1.5 text-sm flex-1 outline-none" />
                  <input placeholder="Reason" value={b.reason} onChange={e => {
                    const br = [...breaks]; br[i].reason = e.target.value; setBreaks(br);
                  }} className="border border-gray-200 rounded px-2 py-1.5 text-sm w-24 outline-none" />
                  <button onClick={() => removeBreak(i)} className="text-red-400 hover:text-red-600 text-sm flex-shrink-0">x</button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Upcoming Days</label>
            <p className="text-xs text-gray-400 mb-3">
              {repeating
                ? 'Tap a date to turn it on or off.'
                : 'Only this week\'s dates are active. Future weeks are auto-blocked.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {getNext10Dates().map(d => {
                const available = isDateAvailable(d);
                const daySchedule = schedule.find(s => s.day === d.dayName);
                return (
                  <button key={d.dateStr} type="button" onClick={() => toggleBlockDate(d.dateStr)}
                    className={`p-3 rounded-lg border text-left transition ${
                      available
                        ? 'bg-green-50 border-green-200 text-green-700'
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{d.label}</span>
                      {available && <span className="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded">On</span>}
                    </div>
                    {available && daySchedule?.enabled && (
                      <p className="text-xs mt-0.5 opacity-75">
                        {daySchedule.startTime} — {daySchedule.endTime}
                      </p>
                    )}
                    {!available && (
                      <p className="text-xs mt-0.5">Off</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

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
                const availDays = getNext10Dates().filter(d => isDateAvailable(d)).length;
                return `~${totalSlots} slots/day, ${enabled.length} days/week, ${availDays} of next 10 days open (${timezone})`;
              })()}
            </p>
          </div>
        </div>

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
