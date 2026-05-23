import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import api from '../api';

const GROUP_LABELS = {
  chatbot: 'Chatbot Message Headers',
  flow_banner: 'Flow Welcome Banner',
  service_icons: 'Service Selection Icons',
};

export default function FlowImages() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState(null);
  const inputs = useRef({});

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/flow-images');
      setItems(data.images);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const onPick = (key) => inputs.current[key]?.click();
  const onUpload = async (key, file) => {
    if (!file) return;
    setUploadingKey(key);
    try {
      const fd = new FormData();
      fd.append('image', file);
      await api.post(`/flow-images/${key}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await load();
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally { setUploadingKey(null); }
  };
  const onClear = async (key) => {
    if (!confirm('Remove this image?')) return;
    await api.delete(`/flow-images/${key}`);
    load();
  };

  const groups = items.reduce((acc, it) => {
    (acc[it.group] = acc[it.group] || []).push(it);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Flow Images</h1>
        <p className="text-sm text-slate-600">Upload the banner & icon images used by the WhatsApp chatbot and flow. Changes go live within ~10 minutes (image cache).</p>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-slate-500">Loading…</div>
      ) : (
        Object.keys(GROUP_LABELS).map((gkey) => {
          const group = groups[gkey] || [];
          if (!group.length) return null;
          return (
            <div key={gkey} className="card overflow-hidden">
              <div className="px-5 py-3 bg-brand-50 border-b border-brand-100 font-semibold text-brand-800">{GROUP_LABELS[gkey]}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {group.map((item) => (
                  <div key={item.key} className="border border-slate-200 rounded-lg p-3 flex flex-col">
                    <div className="aspect-square bg-slate-50 rounded-md overflow-hidden flex items-center justify-center mb-2">
                      {item.url ? (
                        <img src={item.url} alt={item.label} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={36} className="text-slate-300" />
                      )}
                    </div>
                    <div className="text-sm font-medium text-slate-800 line-clamp-2">{item.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">key: {item.key}</div>
                    <div className="mt-3 flex gap-2">
                      <input type="file" accept="image/*" ref={(el) => (inputs.current[item.key] = el)} className="hidden" onChange={(e) => onUpload(item.key, e.target.files?.[0])} />
                      <button onClick={() => onPick(item.key)} disabled={uploadingKey === item.key} className="btn-primary !py-1.5 flex-1 !text-xs">
                        {uploadingKey === item.key ? 'Uploading…' : item.url ? <><Upload size={14}/> Replace</> : <><Upload size={14}/> Upload</>}
                      </button>
                      {item.url && (
                        <button onClick={() => onClear(item.key)} className="btn-danger !py-1.5 !text-xs"><Trash2 size={14}/></button>
                      )}
                    </div>
                    {item.url && (
                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
                        <CheckCircle2 size={12}/> Uploaded
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
