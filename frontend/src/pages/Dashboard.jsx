import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserCheck, Users, Building2, Receipt, IndianRupee, AlertCircle, Phone,
} from 'lucide-react';
import api from '../api';

const cards = [
  { key: 'registeredUsers', label: 'Registered', icon: UserCheck, to: '/registered', color: 'bg-brand-100 text-brand-700' },
  { key: 'nonRegisteredUsers', label: 'Non-Registered', icon: Users, to: '/non-registered', color: 'bg-amber-100 text-amber-700' },
  { key: 'branches', label: 'Branches', icon: Building2, to: '/branches', color: 'bg-sky-100 text-sky-700' },
  { key: 'pendingBills', label: 'Pending Bills (this month)', icon: Receipt, to: '/rent-bills?paid=false', color: 'bg-rose-100 text-rose-700' },
];

export default function Dashboard() {
  const [data, setData] = useState({ stats: {}, recentUsers: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats').then((r) => {
      setData(r.data); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Dashboard</h1>
        <p className="text-sm text-slate-600">Overview of your WhatsApp bot and residents.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ key, label, icon: Icon, to, color }) => (
          <Link key={key} to={to} className="card p-5 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">{label}</div>
                <div className="text-3xl font-bold text-brand-900 mt-1">
                  {loading ? '…' : data.stats[key] ?? 0}
                </div>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={22} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <IndianRupee size={22} />
          </div>
          <div>
            <div className="text-sm text-slate-500">Collected this month</div>
            <div className="text-2xl font-bold text-emerald-700">
              ₹{loading ? '…' : (data.stats.collectedThisMonth || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <AlertCircle size={22} />
          </div>
          <div>
            <div className="text-sm text-slate-500">Pending this month</div>
            <div className="text-2xl font-bold text-rose-700">
              ₹{loading ? '…' : (data.stats.pendingThisMonth || 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold text-brand-800">
          Recent Registrations
        </div>
        {!data.recentUsers?.length ? (
          <div className="p-6 text-sm text-slate-500 text-center">No registrations yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.recentUsers.map((u) => (
              <li key={u._id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-medium">
                  {u.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{u.name}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1"><Phone size={12} /> {u.phone}</span>
                    {u.branch?.code && (
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">{u.branch.code}</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
