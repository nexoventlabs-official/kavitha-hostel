import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api';

const blank = {
  code: '', name: '', address: '', reviewUrl: '', websiteUrl: '', contactPhone: '', sheetTab: '', active: true,
  blocks: [],
};

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/branches/all');
      setBranches(data.branches);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(blank); setEditId(null); setShowForm(true); };
  const openEdit = (b) => { setForm({ ...blank, ...b }); setEditId(b._id); setShowForm(true); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name) return alert('Code and name are required');
    setSaving(true);
    try {
      if (editId) await api.put(`/branches/${editId}`, form);
      else await api.post('/branches', form);
      setShowForm(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this branch? Residents linked to it will keep their record.')) return;
    await api.delete(`/branches/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Branches</h1>
          <p className="text-sm text-slate-600">Each branch has its own Google Sheet tab and Google review URL.</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus size={16}/> New Branch</button>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500">Loading…</div>
      ) : branches.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          No branches yet. Click <strong>New Branch</strong> to add one.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((b) => (
            <div key={b._id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-400">{b.code}</div>
                  <div className="font-semibold text-brand-900 text-lg leading-tight">{b.name}</div>
                </div>
                <span className={`pill ${b.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{b.active ? 'Active' : 'Inactive'}</span>
              </div>
              {b.address && <div className="text-sm text-slate-600 mt-2">{b.address}</div>}
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <div><span className="font-medium text-slate-700">Sheet tab:</span> {b.sheetTab || b.code}</div>
                {b.contactPhone && <div><span className="font-medium text-slate-700">Phone:</span> {b.contactPhone}</div>}
                {b.blocks && b.blocks.length > 0 && (
                  <div>
                    <span className="font-medium text-slate-700">Blocks:</span>{' '}
                    {b.blocks.map((blk) => blk.name).join(', ')} ({b.blocks.reduce((s, blk) => s + (blk.rooms?.length || 0), 0)} rooms)
                  </div>
                )}
                {b.reviewUrl && (
                  <a href={b.reviewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                    <ExternalLink size={11}/> Google review URL
                  </a>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => openEdit(b)} className="btn-secondary flex-1 !py-1.5"><Pencil size={14}/> Edit</button>
                <button onClick={() => remove(b._id)} className="btn-danger !py-1.5"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={submit} className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="font-semibold text-brand-800">{editId ? 'Edit Branch' : 'New Branch'}</div>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Code *</label>
                  <input className="input uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} disabled={!!editId} required />
                </div>
                <div>
                  <label className="label">Sheet Tab Name</label>
                  <input className="input" value={form.sheetTab} onChange={(e) => setForm({ ...form, sheetTab: e.target.value })} placeholder="defaults to code" />
                </div>
              </div>
              <div>
                <label className="label">Branch Name *</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Address</label>
                <textarea className="input" rows="2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label className="label">Contact Phone</label>
                <input className="input" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="+91-..." />
              </div>
              <div>
                <label className="label">Website URL</label>
                <input className="input" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <label className="label">Google Review URL</label>
                <input className="input" value={form.reviewUrl} onChange={(e) => setForm({ ...form, reviewUrl: e.target.value })} placeholder="https://g.page/r/..." />
                <p className="text-[11px] text-slate-500 mt-1">Sent to residents when they pick "Review & Rating" on WhatsApp.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Show this branch in the registration form
              </label>

              {/* Blocks and Rooms */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="label !mb-0">Blocks & Rooms</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, blocks: [...form.blocks, { name: '', rooms: [] }] })}
                    className="text-sm text-brand-700 hover:text-brand-800 font-medium"
                  >
                    + Add Block
                  </button>
                </div>
                {form.blocks.length === 0 ? (
                  <div className="text-sm text-slate-500 italic">No blocks added yet</div>
                ) : (
                  <div className="space-y-3">
                    {form.blocks.map((block, bIdx) => (
                      <div key={bIdx} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            className="input !py-1.5 text-sm"
                            placeholder="Block name (e.g. A, B, Main)"
                            value={block.name}
                            onChange={(e) => {
                              const newBlocks = [...form.blocks];
                              newBlocks[bIdx].name = e.target.value;
                              setForm({ ...form, blocks: newBlocks });
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newBlocks = form.blocks.filter((_, i) => i !== bIdx);
                              setForm({ ...form, blocks: newBlocks });
                            }}
                            className="text-red-600 hover:text-red-700 p-1"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <div>
                          <label className="text-xs text-slate-600 mb-1 block">Rooms (comma separated)</label>
                          <input
                            className="input !py-1.5 text-sm"
                            placeholder="101, 102, 103, 201, 202"
                            value={block.rooms.join(', ')}
                            onChange={(e) => {
                              const rooms = e.target.value
                                .split(',')
                                .map((r) => r.trim())
                                .filter(Boolean);
                              const newBlocks = [...form.blocks];
                              newBlocks[bIdx].rooms = rooms;
                              setForm({ ...form, blocks: newBlocks });
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary" disabled={saving}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
