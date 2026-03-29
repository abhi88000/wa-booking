import React, { useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { patients } from '../api';

export default function Patients() {
  const [data, setData] = useState({ patients: [], page: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadPatients(); }, [search]);

  async function loadPatients() {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      const result = await patients.list(params);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Patients</h2>
          <p className="text-gray-500 mt-1">All registered patients from WhatsApp</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none w-64"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Patient</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Appointments</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Last Visit</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
                </td>
              </tr>
            ) : data.patients.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-12 text-gray-400">No patients found</td>
              </tr>
            ) : (
              data.patients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-medium">
                        {(patient.name || '?')[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{patient.name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{patient.phone}</td>
                  <td className="px-5 py-3 text-gray-600">{patient.total_appointments || 0}</td>
                  <td className="px-5 py-3 text-gray-600">{patient.last_visit || 'Never'}</td>
                  <td className="px-5 py-3 text-gray-500 text-sm">
                    {new Date(patient.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
