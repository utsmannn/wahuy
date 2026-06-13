import { useState, useEffect } from 'react';
import { X, Send, Image, FileText, MapPin, MessageSquare, LayoutTemplate, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Session, ProviderInfo, WhatsAppTemplate } from '../types';

interface SendMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessions: Session[];
  providerInfo?: ProviderInfo | null;
}

type MessageType = 'text' | 'image' | 'document' | 'location' | 'template';

export function SendMessageModal({ isOpen, onClose, sessionId, sessions, providerInfo }: SendMessageModalProps) {
  const [msgType, setMsgType] = useState<MessageType>('text');
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [base64, setBase64] = useState('');
  const [mime, setMime] = useState('');
  const [fname, setFname] = useState('');
  const [caption, setCaption] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [desc, setDesc] = useState('');
  const [selSession, setSelSession] = useState(sessionId);
  const [loading, setLoading] = useState(false);

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [selTpl, setSelTpl] = useState<WhatsAppTemplate | null>(null);
  const [tplVars, setTplVars] = useState<string[]>([]);

  const isOfficial = providerInfo?.mode === 'official';

  useEffect(() => {
    if (msgType === 'template' && isOfficial && templates.length === 0) {
      setLoadingTpl(true);
      api.getTemplates().then(r => setTemplates(r.data || [])).catch(() => {}).finally(() => setLoadingTpl(false));
    }
  }, [msgType, isOfficial]);

  if (!isOpen) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { setBase64((r.result as string).split(',')[1]); setMime(f.type); setFname(f.name); };
    r.readAsDataURL(f);
  };

  const reset = () => { setTo(''); setText(''); setBase64(''); setMime(''); setFname(''); setCaption(''); setLat(''); setLng(''); setDesc(''); setSelTpl(null); setTplVars([]); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      let r;
      switch (msgType) {
        case 'text': r = await api.sendMessage(selSession, to, text); break;
        case 'image': r = await api.sendImage(selSession, to, base64, mime, caption, fname); break;
        case 'document': r = await api.sendDocument(selSession, to, base64, mime, fname, caption); break;
        case 'location': r = await api.sendLocation(selSession, to, parseFloat(lat), parseFloat(lng), desc); break;
        case 'template':
          if (!selTpl) break;
          r = await api.sendTemplate({ to, templateName: selTpl.name, languageCode: selTpl.language, variables: tplVars.filter(v => v) }); break;
      }
      if (r?.success) { alert('Sent!'); onClose(); reset(); }
    } catch (err) { alert(`Error: ${(err as Error).message}`); }
    finally { setLoading(false); }
  };

  const types: { id: MessageType; label: string; icon: typeof MessageSquare; officialOnly?: boolean }[] = [
    { id: 'text', label: 'Text', icon: MessageSquare },
    { id: 'template', label: 'Template', icon: LayoutTemplate, officialOnly: true },
    { id: 'image', label: 'Image', icon: Image },
    { id: 'document', label: 'File', icon: FileText },
    { id: 'location', label: 'Location', icon: MapPin },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 w-full max-w-lg max-h-[90vh] flex flex-col shadow-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold">Send Message</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {!isOfficial && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Session</label>
              <select value={selSession} onChange={e => setSelSession(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400">
                {sessions.filter(s => s.status === 'ready').map(s => (
                  <option key={s.id} value={s.id}>{s.name || s.id}{s.phone ? ` — ${s.phone}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <div className="flex gap-1.5 flex-wrap">
              {types.filter(t => !t.officialOnly || isOfficial).map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setMsgType(id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    msgType === id ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="text" value={to} onChange={e => setTo(e.target.value)} placeholder="6281234567890"
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 font-mono" required />
          </div>

          {msgType === 'text' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Type your message..."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none" required />
            </div>
          )}

          {msgType === 'template' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Template</label>
                {loadingTpl ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 size={12} className="animate-spin" />Loading templates...</div>
                ) : (
                  <select value={selTpl?.id || ''} onChange={e => {
                    const t = templates.find(t => t.id === e.target.value);
                    if (t) {
                      setSelTpl(t);
                      const bc = t.components?.find(c => c.type === 'BODY');
                      const cnt = bc?.text ? (bc.text.match(/\{\{\d+\}\}/g) || []).length : 0;
                      setTplVars(new Array(cnt).fill(''));
                    }
                  }} className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" required>
                    <option value="">Select template...</option>
                    {templates.filter(t => t.status === 'APPROVED').map(t => (<option key={t.id} value={t.id}>{t.name} ({t.language})</option>))}
                  </select>
                )}
              </div>
              {selTpl && tplVars.map((v, i) => (
                <div key={i}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Variable {i + 1}</label>
                  <input type="text" value={v} onChange={e => { const n = [...tplVars]; n[i] = e.target.value; setTplVars(n); }}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" required />
                </div>
              ))}
            </div>
          )}

          {(msgType === 'image' || msgType === 'document') && (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
                <input type="file" id="file-upload" accept={msgType === 'image' ? 'image/*' : '*/*'} onChange={handleFile} className="hidden" />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <p className="text-sm font-medium">{fname || `Click to select ${msgType}`}</p>
                  <p className="text-xs text-gray-400 mt-1">Max 16MB</p>
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Caption</label>
                <input type="text" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Optional"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
              </div>
            </div>
          )}

          {msgType === 'location' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Latitude</label>
                  <input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="-6.2088"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 font-mono" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Longitude</label>
                  <input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="106.8456"
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 font-mono" required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Office"
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
              </div>
            </div>
          )}
        </form>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          <button onClick={handleSubmit} type="submit" disabled={loading || (msgType === 'template' && !selTpl)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send
          </button>
        </div>
      </div>
    </div>
  );
}
