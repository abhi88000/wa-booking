import React, { useEffect, useState } from 'react';
import { Calendar, Filter, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { appointments } from '../api';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-gray-100 text-gray-700',
  rescheduled: 'bg-purple-100 text-purple-700',
};

export default function Appointments() {
  const [data, setData] = useState({ appointments: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ date: '', status: '', page: 1 });

  useEffect(() => {
    loadAppointments();
  }, [filters]);

  async function loadAppointments() {
    setLoading(true);
    try {
      const params = {};
      if (filters.date) params.date = filters.date;
      if (filters.status) params.status = filters.status;
      params.page = filters.page;
      const result = await appointments.list(params);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, newStatus) {
    try {
      await appointments.updateStatus(id, newStatus);
      loadAppointments();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Appointments</h2>
          <p className="text-gray-500 mt-1">{data.total} total appointments</p>
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={filters.date}
            onChange={(e) => setFilters({ ...filters, date: e.target.value, page: 1 })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Patient</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Doctor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Date & Time</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-12">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
                  </td>
                </tr>
              ) : data.appointments.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-12 text-gray-400">No appointments found</td>
                </tr>
              ) : (
                data.appointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{apt.patient_name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{apt.patient_phone}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-gray-900">{apt.doctor_name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{apt.specialization}</div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-gray-900">{apt.appointment_date}</div>
                      <div className="text-xs text-gray-500">{apt.start_time} - {apt.end_time}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[apt.status] || 'bg-gray-100 text-gray-700'}`}>
                        {apt.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        {apt.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateStatus(apt.id, 'confirmed')}
                              className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"
                              title="Confirm"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateStatus(apt.id, 'cancelled')}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                              title="Cancel"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {apt.status === 'confirmed' && (
                          <>
                            <button
                              onClick={() => updateStatus(apt.id, 'completed')}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600"
                              title="Mark Complete"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateStatus(apt.id, 'no_show')}
                              className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-600"
                              title="No Show"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Page {data.page} of {data.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
                disabled={filters.page <= 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFilters({ ...filters, page: Math.min(data.totalPages, filters.page + 1) })}
                disabled={filters.page >= data.totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
