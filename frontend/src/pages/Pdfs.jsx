import { useEffect, useState } from 'react';
import { Upload, Trash2, FileText, ExternalLink } from 'lucide-react';
import api from '../api';

const SLOT_META = {
  per_month_cost: { label: 'Per Month Cost', help: 'Pricing PDF sent when residents tap "Per Month Cost"' },
  food_timings: { label: 'Food Timings', help: 'Meal schedule PDF' },
  hostel_rules: { label: 'Hostel Rules', help: 'House rules PDF' },
};

export default function Pdfs() {
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingSlot, setUploadingSlot] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/pdfs');
      setPdfs(data.pdfs);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const upload = async (slot, fields) => {
    setUploadingSlot(slot);
    try {
      const fd = new FormData();
      if (fields.name) fd.append('name', fields.name);
      if (fields.description !== undefined) fd.append('description', fields.description);
      if (fields.active !== undefined) fd.append('active', String(fields.active));
      if (fields.file) fd.append('pdf', fields.file);
      await api.post(`/pdfs/${slot}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally { setUploadingSlot(null); }
  };

  const remove = async (slot) => {
    if (!confirm('Remove this PDF?')) return;
    await api.delete(`/pdfs/${slot}`);
    load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">PDF Resources</h1>
        <p className="text-sm text-slate-600">
          Upload the three PDFs sent automatically by the WhatsApp bot. Each slot stores one current PDF.
        </p>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {pdfs.map((p) => (
            <SlotCard
              key={p.slot}
              pdf={p}
              meta={SLOT_META[p.slot]}
              uploading={uploadingSlot === p.slot}
              onUpload={upload}
              onRemove={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SlotCard({ pdf, meta, uploading, onUpload, onRemove }) {
  const [name, setName] = useState(pdf.name || meta.label);
  const [desc, setDesc] = useState(pdf.description || '');
  const [active, setActive] = useState(pdf.active !== false);
  const [file, setFile] = useState(null);

  useEffect(() => {
    setName(pdf.name || meta.label);
    setDesc(pdf.description || '');
    setActive(pdf.active !== false);
  }, [pdf.name, pdf.description, pdf.active, meta.label]);

  const save = () => onUpload(pdf.slot, { name, description: desc, active, file });

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="px-5 py-3 bg-brand-50 border-b border-brand-100 font-semibold text-brand-800 flex items-center justify-between">
        {meta.label}
        <span className={`pill ${pdf.pdfUrl ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
          {pdf.pdfUrl ? 'Uploaded' : 'Empty'}
        </span>
      </div>
      <div className="p-4 space-y-3 flex-1">
        <p className="text-xs text-slate-500">{meta.help}</p>
        <div>
          <label className="label">Display name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Description / caption</label>
          <textarea className="input" rows="2" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div>
          <label className="label">{pdf.pdfUrl ? 'Replace PDF (optional)' : 'Choose PDF *'}</label>
          <input type="file" accept="application/pdf" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {pdf.pdfUrl && (
            <a href={pdf.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline mt-1">
              <ExternalLink size={11}/> Current PDF
            </a>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active — bot will send this to residents
        </label>
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <button onClick={save} disabled={uploading} className="btn-primary flex-1">
          {uploading ? 'Uploading…' : <><Upload size={14}/> Save</>}
        </button>
        {pdf.pdfUrl && (
          <button onClick={() => onRemove(pdf.slot)} className="btn-danger"><Trash2 size={14}/></button>
        )}
      </div>
    </div>
  );
}
