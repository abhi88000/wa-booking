import React, { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { payments } from '../api';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  refunded: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
};

export default function Payments() {
  const [data, setData] = useState({ payments: [], page: 1 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => { loadPayments(); }, [filter]);

  async function loadPayments() {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.status = filter;
      const result = await payments.list(params);
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
          <h2 className="text-2xl font-bold text-gray-900">Payments</h2>
          <p className="text-gray-500 mt-1">Track all payment transactions</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Patient</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Doctor</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan="5" className="text-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
                </td>
              </tr>
            ) : data.payments.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-12 text-gray-400">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  No payments found
                </td>
              </tr>
            ) : (
              data.payments.map((pay) => (
                <tr key={pay.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{pay.patient_name || 'Unknown'}</div>
                    <div className="text-xs text-gray-500">{pay.patient_phone}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{pay.doctor_name || 'N/A'}</td>
                  <td className="px-5 py-3 font-semibold text-gray-900">
                    ₹{Number(pay.amount).toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[pay.status] || ''}`}>
                      {pay.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-sm">
                    {new Date(pay.created_at).toLocaleDateString()}
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
