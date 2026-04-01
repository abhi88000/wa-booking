import { useState, useEffect } from 'react';
import api from '../api';

const STATUS_COLOR = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  failed: 'bg-red-100 text-red-600',
  refunded: 'bg-gray-100 text-gray-600',
};

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPayments()
      .then(({ data }) => setPayments(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Payments</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Collected</p>
          <p className="text-2xl font-bold text-green-600 mt-1">₹{totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">₹{totalPending.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Transactions</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{payments.length}</p>
        </div>
      </div>

      {/* Payment List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-500">Loading...</div> : (
          <>
            {/* Desktop */}
            <table className="w-full text-sm hidden sm:table">
              <thead className="bg-gray-50 text-gray-600 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Doctor</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.patient_name || '—'}</div>
                      <div className="text-xs text-gray-400">{p.patient_phone}</div>
                    </td>
                    <td className="px-4 py-3">{p.doctor_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{p.appointment_date || new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium">₹{Number(p.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{p.payment_method || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-500'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-400">No payments recorded yet</td></tr>
                )}
              </tbody>
            </table>

            {/* Mobile */}
            <div className="sm:hidden divide-y">
              {payments.map(p => (
                <div key={p.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{p.patient_name || 'Patient'}</p>
                      <p className="text-xs text-gray-400">{p.doctor_name} - {p.appointment_date || new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">₹{Number(p.amount).toLocaleString()}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[p.status] || 'bg-gray-100 text-gray-500'}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {payments.length === 0 && (
                <div className="p-8 text-center text-gray-400">No payments recorded yet</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
