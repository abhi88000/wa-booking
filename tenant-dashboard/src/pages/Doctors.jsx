import { useState, useEffect } from 'react';
import api from '../api';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editingAvail, setEditingAvail] = useState(null);
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
        <button onClick={openAdd}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
          + Add Doctor
        </button>
      </div>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">{editingDoc ? 'Edit Doctor' : 'Add Doctor'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
              <input placeholder="Specialization" value={form.specialization} onChange={e => setForm({...form, specialization: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                <input placeholder="Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Fee</label>
                  <input type="number" value={form.consultationFee} onChange={e => setForm({...form, consultationFee: parseInt(e.target.value)})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Slot Duration (min)</label>
                  <input type="number" value={form.slotDuration} onChange={e => setForm({...form, slotDuration: parseInt(e.target.value)})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm">
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
          doctors.map(doc => (
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
                  <p className="text-xs text-gray-400 mb-1">Available:</p>
                  <div className="flex flex-wrap gap-1">
                    {doc.availability.filter(Boolean).map((a, i) => (
                      <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded capitalize">
                        {a.day?.substring(0, 3)} {a.start_time?.substring(0,5)}-{a.end_time?.substring(0,5)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => setEditingAvail(doc)}
                className="mt-4 w-full text-center text-sm text-indigo-600 border border-indigo-200 rounded-lg py-2 hover:bg-indigo-50">
                Set Availability
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
  const [schedule, setSchedule] = useState(
    DAYS.map(day => ({ day, enabled: false, startTime: '10:00', endTime: '16:00' }))
  );
  const [breaks, setBreaks] = useState([{ startTime: '13:00', endTime: '14:00', reason: 'Lunch' }]);
  const [slotDuration, setSlotDuration] = useState(20);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getDoctorAvailability(doctorId).then(({ data }) => {
      setSlotDuration(data.slotDuration || 20);
      if (data.availability.length > 0) {
        setSchedule(DAYS.map(day => {
          const match = data.availability.find(a => a.day === day);
          return match
            ? { day, enabled: true, startTime: match.start_time.substring(0, 5), endTime: match.end_time.substring(0, 5) }
            : { day, enabled: false, startTime: '10:00', endTime: '16:00' };
        }));
      }
      if (data.breaks.length > 0) {
        setBreaks(data.breaks.filter(b => !b.break_date).map(b => ({
          startTime: b.start_time.substring(0, 5),
          endTime: b.end_time.substring(0, 5),
          reason: b.reason || 'Break'
        })));
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

  const save = async () => {
    setSaving(true);
    try {
      await api.updateDoctorAvailability(doctorId, {
        slotDuration,
        availability: schedule.filter(s => s.enabled).map(s => ({
          day: s.day, startTime: s.startTime, endTime: s.endTime
        })),
        breaks: breaks.filter(b => b.startTime && b.endTime).map(b => ({
          startTime: b.startTime, endTime: b.endTime, reason: b.reason
        }))
      });
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  if (!loaded) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg my-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Availability — {doctorName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        {/* Slot Duration */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">Slot Duration (minutes)</label>
          <select value={slotDuration} onChange={e => setSlotDuration(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full outline-none focus:ring-2 focus:ring-indigo-500">
            <option value={10}>10 min</option>
            <option value={15}>15 min</option>
            <option value={20}>20 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>

        {/* Weekly Schedule */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Weekly Schedule</label>
          <div className="space-y-2">
            {schedule.map((s, i) => (
              <div key={s.day} className="flex items-center gap-2">
                <button type="button" onClick={() => toggleDay(i)}
                  className={`w-12 text-xs py-1.5 rounded font-medium ${s.enabled ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
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
                  <span className="text-xs text-gray-400 ml-2">Not available</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Breaks */}
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">Daily Breaks</label>
            <button onClick={addBreak} className="text-indigo-600 text-xs hover:underline">+ Add Break</button>
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
                }} className="border border-gray-300 rounded px-2 py-1.5 text-sm flex-1 outline-none" />
                <button onClick={() => removeBreak(i)} className="text-red-400 hover:text-red-600 text-sm">x</button>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="mb-5 bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Preview: Slots generated per day</p>
          <p className="text-sm text-gray-700">
            {(() => {
              const enabled = schedule.filter(s => s.enabled);
              if (enabled.length === 0) return 'No days selected';
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
              return `~${totalSlots} slots of ${slotDuration} min (${DAY_LABELS[enabled[0].day]} ${s.startTime}–${s.endTime}, ${breakMins} min break)`;
            })()}
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500">Cancel</button>
          <button onClick={save} disabled={saving}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Availability'}
          </button>
        </div>
      </div>
    </div>
  );
}
