import { useEffect, useState } from 'react';
import { Search, Trash2, Phone, ExternalLink, FileText, CheckCircle2, Clock } from 'lucide-react';
import api from '../api';

function thisMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function RegisteredUsers() {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [branch, setBranch] = useState('');
  const [bills, setBills] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users/registered', { params: { q, branch } });
      setUsers(data.users);
    } finally { setLoading(false); }
  };

  const loadBills = async () => {
    try {
      const { data } = await api.get('/rent-bills', { params: { monthKey: thisMonthKey() } });
      setBills(data.bills);
    } catch (err) {
      console.error('Failed to load bills:', err);
    }
  };

  useEffect(() => {
    api.get('/branches/all').then((r) => setBranches(r.data.branches)).catch(() => {});
    load();
    loadBills();
    // eslint-disable-next-line
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [branch]);

  const remove = async (id) => {
    if (!confirm('Delete this resident? This does not refund any payments.')) return;
    await api.delete(`/users/${id}`);
    load();
  };

  // Helper to check if user has paid this month
  const getUserBillStatus = (userId) => {
    const bill = bills.find((b) => b.user?._id === userId);
    if (!bill) return null;
    return bill.paid;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Registered Residents</h1>
          <p className="text-sm text-slate-600">{users.length} shown</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className="input !w-44">
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>{b.code} — {b.name}</option>
            ))}
          </select>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, room…" className="input pl-9 w-64 max-w-full" />
          </form>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No residents found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Resident</th>
                  <th className="px-4 py-3 text-left">Branch</th>
                  <th className="px-4 py-3 text-left">Room</th>
                  <th className="px-4 py-3 text-left">WhatsApp</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-left">This Month</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {u.photoUrl ? (
                          <img src={u.photoUrl} className="w-9 h-9 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-medium">
                            {u.name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.gender || '—'} · {u.age ? `${u.age}y` : '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px]">{u.branch?.code || u.branchCode || '—'}</span></td>
                    <td className="px-4 py-3">{u.block ? `${u.block}-` : ''}{u.roomNumber || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1"><Phone size={14}/> {u.phone}</span></td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{u.dateJoined || new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        const paid = getUserBillStatus(u._id);
                        if (paid === true) {
                          return <span className="pill bg-emerald-100 text-emerald-700"><CheckCircle2 size={12}/> Paid</span>;
                        } else if (paid === false) {
                          return <span className="pill bg-amber-100 text-amber-700"><Clock size={12}/> Unpaid</span>;
                        }
                        return <span className="text-slate-400 text-xs">No bill</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        {u.registrationPdfUrl && (
                          <a href={u.registrationPdfUrl} target="_blank" rel="noreferrer" title="View registration PDF" className="p-2 rounded-md text-brand-700 hover:bg-brand-50">
                            <FileText size={16} />
                          </a>
                        )}
                        {u.aadharUrl && (
                          <a href={u.aadharUrl} target="_blank" rel="noreferrer" title="View Aadhar" className="p-2 rounded-md text-slate-600 hover:bg-slate-100">
                            <ExternalLink size={16} />
                          </a>
                        )}
                        <button onClick={() => remove(u._id)} title="Delete" className="p-2 rounded-md text-red-600 hover:bg-red-50">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
