import { useEffect, useState } from 'react';
import { Phone, Clock } from 'lucide-react';
import api from '../api';

export default function NonRegisteredUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/non-registered').then((r) => {
      setUsers(r.data.users);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Non-Registered Contacts</h1>
        <p className="text-sm text-slate-600">{users.length} people who messaged the bot but have not completed registration.</p>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No leads yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">WhatsApp</th>
                  <th className="px-4 py-3 text-left">Language</th>
                  <th className="px-4 py-3 text-left">Last Message</th>
                  <th className="px-4 py-3 text-left">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{u.profileName || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1"><Phone size={14}/> {u.phone}</span></td>
                    <td className="px-4 py-3 uppercase text-xs">{u.language || '—'}</td>
                    <td className="px-4 py-3 max-w-xs truncate" title={u.lastMessage}>{u.lastMessage || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1"><Clock size={12}/> {new Date(u.lastSeenAt).toLocaleString()}</span>
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
