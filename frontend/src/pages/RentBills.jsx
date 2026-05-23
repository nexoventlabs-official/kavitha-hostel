import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, X, CheckCircle2, Receipt, Search, Zap, Users } from 'lucide-react';
import api from '../api';

function thisMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const blank = {
  userId: '', monthKey: thisMonthKey(),
  rentAmount: '', ebAmount: '', otherAmount: '', notes: '',
};

export default function RentBills() {
  const [bills, setBills] = useState([]);
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ branch: '', monthKey: thisMonthKey(), paid: '', q: '' });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Room-EB split modal state
  const [showRoomEb, setShowRoomEb] = useState(false);
  const [ebForm, setEbForm] = useState({
    branch: '',
    block: '',
    roomNumber: '',
    monthKey: thisMonthKey(),
    ebAmount: '',
  });
  const [ebSaving, setEbSaving] = useState(false);
  const [ebResult, setEbResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/rent-bills', { params: filters });
      setBills(data.bills);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    api.get('/branches/all').then((r) => setBranches(r.data.branches)).catch(() => {});
    api.get('/users/registered').then((r) => setUsers(r.data.users)).catch(() => {});
  }, []);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters.branch, filters.monthKey, filters.paid]);

  const openCreate = (preset = {}) => {
    setForm({ ...blank, ...preset, monthKey: filters.monthKey || thisMonthKey() });
    setEditId(null); setShowForm(true);
  };
  const openEdit = (b) => {
    setForm({
      userId: b.user?._id || '',
      monthKey: b.monthKey,
      rentAmount: b.rentAmount,
      ebAmount: b.ebAmount,
      otherAmount: b.otherAmount,
      notes: b.notes || '',
    });
    setEditId(b._id); setShowForm(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.userId || !form.monthKey) return alert('Resident and month are required');
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/rent-bills/${editId}`, {
          rentAmount: Number(form.rentAmount) || 0,
          ebAmount: Number(form.ebAmount) || 0,
          otherAmount: Number(form.otherAmount) || 0,
          notes: form.notes,
          monthKey: form.monthKey,
        });
      } else {
        await api.post('/rent-bills', form);
      }
      setShowForm(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this bill?')) return;
    await api.delete(`/rent-bills/${id}`);
    load();
  };

  const collected = bills.filter((b) => b.paid).reduce((s, b) => s + (b.totalAmount || 0), 0);
  const pending = bills.filter((b) => !b.paid).reduce((s, b) => s + (b.totalAmount || 0), 0);

  /* ─────── Room-EB modal helpers ─────── */
  const openRoomEb = () => {
    setEbForm({
      branch: filters.branch || '',
      block: '',
      roomNumber: '',
      monthKey: filters.monthKey || thisMonthKey(),
      ebAmount: '',
    });
    setEbResult(null);
    setShowRoomEb(true);
  };

  // Residents matching the selected branch (+ block) — used to derive room list
  const branchUsers = useMemo(() => {
    if (!ebForm.branch) return [];
    return users.filter((u) => {
      const uBranchId = u.branch?._id || u.branch;
      if (uBranchId !== ebForm.branch) return false;
      if (ebForm.block && (u.block || '') !== ebForm.block) return false;
      return true;
    });
  }, [users, ebForm.branch, ebForm.block]);

  // Unique room numbers in the selected branch+block, with resident counts
  const roomOptions = useMemo(() => {
    const map = new Map();
    branchUsers.forEach((u) => {
      const room = (u.roomNumber || '').trim();
      if (!room) return;
      map.set(room, (map.get(room) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([room, count]) => ({ room, count }));
  }, [branchUsers]);

  // Unique blocks in the selected branch
  const blockOptions = useMemo(() => {
    const set = new Set();
    users.forEach((u) => {
      const uBranchId = u.branch?._id || u.branch;
      if (uBranchId !== ebForm.branch) return;
      if (u.block) set.add(u.block);
    });
    return Array.from(set).sort();
  }, [users, ebForm.branch]);

  // Residents currently selected (for preview)
  const ebPreviewUsers = useMemo(() => {
    if (!ebForm.roomNumber) return [];
    return branchUsers.filter(
      (u) => (u.roomNumber || '').trim() === ebForm.roomNumber.trim()
    );
  }, [branchUsers, ebForm.roomNumber]);

  const ebTotal = Number(ebForm.ebAmount) || 0;
  const ebShare =
    ebPreviewUsers.length > 0 ? Math.floor(ebTotal / ebPreviewUsers.length) : 0;
  const ebRemainder = ebTotal - ebShare * ebPreviewUsers.length;

  const submitRoomEb = async (e) => {
    e.preventDefault();
    if (!ebForm.branch || !ebForm.roomNumber || !ebForm.monthKey || !ebForm.ebAmount) {
      return alert('Branch, room, month and EB amount are required');
    }
    if (ebPreviewUsers.length === 0) {
      return alert('No residents found for the selected room');
    }
    if (!confirm(
      `Split ₹${ebTotal} EB bill among ${ebPreviewUsers.length} resident(s) of room ${ebForm.roomNumber}?`
    )) return;
    setEbSaving(true);
    try {
      const { data } = await api.post('/rent-bills/room-eb', {
        branch: ebForm.branch,
        block: ebForm.block || undefined,
        roomNumber: ebForm.roomNumber,
        monthKey: ebForm.monthKey,
        ebAmount: ebTotal,
      });
      setEbResult(data);
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setEbSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Rent Bills</h1>
          <p className="text-sm text-slate-600">Create monthly bills, mark them paid, and sync to Google Sheets.</p>
        </div>
        <button onClick={openRoomEb} className="btn-primary" title="Split a room's EB bill equally among its residents">
          <Zap size={16}/> Room EB Bill
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-xs text-slate-500">Bills shown</div>
          <div className="text-xl font-bold">{bills.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Collected</div>
          <div className="text-xl font-bold text-emerald-700">₹{collected.toLocaleString('en-IN')}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Pending</div>
          <div className="text-xl font-bold text-rose-700">₹{pending.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <select value={filters.branch} onChange={(e) => setFilters({ ...filters, branch: e.target.value })} className="input !w-44">
          <option value="">All branches</option>
          {branches.map((b) => <option key={b._id} value={b._id}>{b.code} — {b.name}</option>)}
        </select>
        <input type="month" value={filters.monthKey} onChange={(e) => setFilters({ ...filters, monthKey: e.target.value })} className="input !w-44" />
        <select value={filters.paid} onChange={(e) => setFilters({ ...filters, paid: e.target.value })} className="input !w-36">
          <option value="">All status</option>
          <option value="false">Unpaid</option>
          <option value="true">Paid</option>
        </select>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Search name/phone/room…" className="input pl-9 !w-56" />
        </form>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading…</div>
        ) : bills.length === 0 ? (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
            <Receipt size={36} className="text-slate-300"/>
            No bills for the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Resident</th>
                  <th className="px-4 py-3 text-left">Branch / Room</th>
                  <th className="px-4 py-3 text-left">Month</th>
                  <th className="px-4 py-3 text-right">Rent</th>
                  <th className="px-4 py-3 text-right">EB</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium">{b.user?.name || '—'}</div>
                      <div className="text-xs text-slate-500">{b.user?.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[11px]">{b.branch?.code || '—'}</span>
                      <span className="ml-2 text-slate-600">{b.roomNumber || b.user?.roomNumber || '—'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.monthLabel || b.monthKey}</td>
                    <td className="px-4 py-3 text-right">₹{b.rentAmount}</td>
                    <td className="px-4 py-3 text-right">₹{b.ebAmount}</td>
                    <td className="px-4 py-3 text-right font-semibold">₹{b.totalAmount}</td>
                    <td className="px-4 py-3">
                      {b.paid ? (
                        <span className="pill bg-emerald-100 text-emerald-700"><CheckCircle2 size={12}/> Paid</span>
                      ) : (
                        <span className="pill bg-amber-100 text-amber-700">Unpaid</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => openEdit(b)} title="Edit" className="p-2 rounded-md text-slate-600 hover:bg-slate-100">
                          <Pencil size={14}/>
                        </button>
                        <button onClick={() => remove(b._id)} title="Delete" className="p-2 rounded-md text-red-600 hover:bg-red-50">
                          <Trash2 size={14}/>
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

      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={submit} className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="font-semibold text-brand-800">{editId ? 'Edit Bill' : 'New Bill'}</div>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="label">Resident *</label>
                <select className="input" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} disabled={!!editId} required>
                  <option value="">Select resident</option>
                  {users.map((u) => (
                    <option key={u._id} value={u._id}>{u.name} — {u.phone} ({u.branch?.code || u.branchCode || '—'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Month *</label>
                <input type="month" className="input" value={form.monthKey} onChange={(e) => setForm({ ...form, monthKey: e.target.value })} required />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Rent (₹)</label>
                  <input type="number" min="0" className="input" value={form.rentAmount} onChange={(e) => setForm({ ...form, rentAmount: e.target.value })} />
                </div>
                <div>
                  <label className="label">EB Bill (₹)</label>
                  <input type="number" min="0" className="input" value={form.ebAmount} onChange={(e) => setForm({ ...form, ebAmount: e.target.value })} />
                </div>
                <div>
                  <label className="label">Other (₹)</label>
                  <input type="number" min="0" className="input" value={form.otherAmount} onChange={(e) => setForm({ ...form, otherAmount: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="text-right text-sm text-slate-600">
                Total: <span className="font-bold text-lg text-brand-800">₹{(Number(form.rentAmount) || 0) + (Number(form.ebAmount) || 0) + (Number(form.otherAmount) || 0)}</span>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary" disabled={saving}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}

      {showRoomEb && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={submitRoomEb} className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-brand-800">
                <Zap size={18} className="text-amber-500" />
                Split Room EB Bill
              </div>
              <button type="button" onClick={() => setShowRoomEb(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20}/>
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-600">
                Enter the total electricity bill for one room. It will be divided
                <span className="font-medium"> equally </span>
                among every resident in that room and added to each person&apos;s monthly bill.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Branch *</label>
                  <select
                    className="input"
                    value={ebForm.branch}
                    onChange={(e) => setEbForm({ ...ebForm, branch: e.target.value, block: '', roomNumber: '' })}
                    required
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>{b.code} — {b.name}</option>
                    ))}
                  </select>
                </div>

                {blockOptions.length > 0 && (
                  <div>
                    <label className="label">Block (optional)</label>
                    <select
                      className="input"
                      value={ebForm.block}
                      onChange={(e) => setEbForm({ ...ebForm, block: e.target.value, roomNumber: '' })}
                    >
                      <option value="">All blocks</option>
                      {blockOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="label">Room *</label>
                  {roomOptions.length > 0 ? (
                    <select
                      className="input"
                      value={ebForm.roomNumber}
                      onChange={(e) => setEbForm({ ...ebForm, roomNumber: e.target.value })}
                      required
                    >
                      <option value="">Select room</option>
                      {roomOptions.map((r) => (
                        <option key={r.room} value={r.room}>
                          Room {r.room} — {r.count} resident{r.count > 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="input"
                      value={ebForm.roomNumber}
                      onChange={(e) => setEbForm({ ...ebForm, roomNumber: e.target.value })}
                      placeholder={ebForm.branch ? 'No rooms found — type one' : 'Pick a branch first'}
                      disabled={!ebForm.branch}
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="label">Month *</label>
                  <input
                    type="month"
                    className="input"
                    value={ebForm.monthKey}
                    onChange={(e) => setEbForm({ ...ebForm, monthKey: e.target.value })}
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="label">Total EB Bill for this room (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={ebForm.ebAmount}
                    onChange={(e) => setEbForm({ ...ebForm, ebAmount: e.target.value })}
                    placeholder="e.g. 1500"
                    required
                  />
                </div>
              </div>

              {/* Preview */}
              {ebPreviewUsers.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-medium text-amber-800">
                      <Users size={14} /> {ebPreviewUsers.length} resident{ebPreviewUsers.length > 1 ? 's' : ''} in this room
                    </div>
                    {ebTotal > 0 && (
                      <div className="text-amber-900">
                        Each pays <span className="font-bold">₹{ebShare}</span>
                        {ebRemainder > 0 && <span className="text-xs"> (+₹{ebRemainder} to last)</span>}
                      </div>
                    )}
                  </div>
                  <ul className="mt-2 divide-y divide-amber-200/70 text-sm">
                    {ebPreviewUsers.map((u, i) => {
                      const share = ebShare + (i === ebPreviewUsers.length - 1 ? ebRemainder : 0);
                      return (
                        <li key={u._id} className="py-1.5 flex items-center justify-between">
                          <span>
                            <span className="font-medium">{u.name}</span>
                            <span className="text-slate-500 text-xs ml-2">{u.phone}</span>
                          </span>
                          {ebTotal > 0 && (
                            <span className="font-semibold text-amber-900">₹{share}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : ebForm.branch && ebForm.roomNumber ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  No registered residents in this room yet.
                </div>
              ) : null}

              {/* Success result */}
              {ebResult && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <div className="font-medium text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 size={14}/> Split ₹{ebResult.totalEb} EB across {ebResult.residents} resident(s) for {ebResult.monthLabel}.
                  </div>
                  <ul className="mt-1 ml-5 list-disc text-emerald-900">
                    {ebResult.results.map((r) => (
                      <li key={r.userId}>
                        {r.name} → EB ₹{r.share} (bill total ₹{r.total})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button type="button" onClick={() => setShowRoomEb(false)} className="btn-secondary" disabled={ebSaving}>
                Close
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={ebSaving || ebPreviewUsers.length === 0 || ebTotal <= 0}
              >
                {ebSaving ? 'Splitting…' : `Split ₹${ebTotal || 0} across ${ebPreviewUsers.length || 0}`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
