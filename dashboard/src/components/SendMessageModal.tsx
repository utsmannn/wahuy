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
  const [messageType, setMessageType] = useState<MessageType>('text');
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [base64Data, setBase64Data] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [filename, setFilename] = useState('');
  const [caption, setCaption] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSession, setSelectedSession] = useState(sessionId);
  const [loading, setLoading] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);

  const isOfficial = providerInfo?.mode === 'official';

  // Load templates when switching to template tab
  useEffect(() => {
    if (messageType === 'template' && isOfficial && templates.length === 0) {
      loadTemplates();
    }
  }, [messageType, isOfficial]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await api.getTemplates();
      setTemplates(res.data || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setBase64Data(base64);
      setMimeType(file.type);
      setFilename(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    // Count body variables from template text
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    if (bodyComponent?.text) {
      const matches = bodyComponent.text.match(/\{\{\d+\}\}/g);
      const count = matches ? matches.length : 0;
      setTemplateVariables(new Array(count).fill(''));
    } else {
      setTemplateVariables([]);
    }
  };

  const updateVariable = (index: number, value: string) => {
    setTemplateVariables(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let response;

      switch (messageType) {
        case 'text':
          response = await api.sendMessage(selectedSession, to, text);
          break;
        case 'image':
          response = await api.sendImage(selectedSession, to, base64Data, mimeType, caption, filename);
          break;
        case 'document':
          response = await api.sendDocument(selectedSession, to, base64Data, mimeType, filename, caption);
          break;
        case 'location':
          response = await api.sendLocation(selectedSession, to, parseFloat(latitude), parseFloat(longitude), description);
          break;
        case 'template':
          if (!selectedTemplate) break;
          response = await api.sendTemplate({
            to,
            templateName: selectedTemplate.name,
            languageCode: selectedTemplate.language,
            variables: templateVariables.filter(v => v.length > 0),
          });
          break;
      }

      if (response?.success) {
        alert('Message sent successfully!');
        onClose();
        resetForm();
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTo('');
    setText('');
    setBase64Data('');
    setMimeType('');
    setFilename('');
    setCaption('');
    setLatitude('');
    setLongitude('');
    setDescription('');
    setSelectedTemplate(null);
    setTemplateVariables([]);
  };

  const messageTypes: Array<{ id: MessageType; label: string; icon: typeof MessageSquare; officialOnly?: boolean }> = [
    { id: 'text', label: 'Text', icon: MessageSquare },
    { id: 'template', label: 'Template', icon: LayoutTemplate, officialOnly: true },
    { id: 'image', label: 'Image', icon: Image },
    { id: 'document', label: 'Document', icon: FileText },
    { id: 'location', label: 'Location', icon: MapPin },
  ];

  // Get preview of template body with variables filled in
  const getTemplatePreview = () => {
    if (!selectedTemplate) return '';
    const bodyComponent = selectedTemplate.components?.find(c => c.type === 'BODY');
    if (!bodyComponent?.text) return '';
    let preview = bodyComponent.text;
    templateVariables.forEach((val, i) => {
      preview = preview.replace(`{{${i + 1}}}`, val || `{{${i + 1}}}`);
    });
    return preview;
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/40 dark:bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-6 font-sans">
      <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl dark:shadow-none animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between p-8 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-10 transition-colors">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">Transmit</h3>
            <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mt-1.5">Outbound Message Dispatch</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-all">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto flex-1 scrollbar-hide">
          {/* Session Selector (only for internal mode) */}
          {!isOfficial && (
            <div>
              <label className="block text-[11px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">Origin Account</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white transition-all cursor-pointer shadow-sm"
                required
              >
                {sessions.filter(s => s.status === 'ready').map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.id} {s.phone && ` — ${s.phone}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Message Type Tabs */}
          <div className="space-y-3">
            <label className="block text-[11px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest px-1">Message Protocol</label>
            <div className="flex gap-2 flex-wrap">
              {messageTypes
                .filter(t => !t.officialOnly || isOfficial)
                .map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMessageType(id)}
                    className={`flex items-center gap-3 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all border shadow-sm ${
                      messageType === id
                        ? 'bg-neutral-900 dark:bg-white border-neutral-900 dark:border-white text-white dark:text-neutral-900'
                        : 'bg-white dark:bg-neutral-800 border-neutral-100 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 hover:border-neutral-200 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
            </div>
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-[11px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">Destination Number</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="6281234567890"
              className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-mono font-bold focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:bg-white dark:focus:bg-neutral-800 transition-all placeholder-neutral-200 dark:placeholder-neutral-700 text-neutral-900 dark:text-white shadow-sm"
              required
            />
          </div>

          {/* Dynamic Fields based on type */}
          <div className="space-y-6 pt-4 border-t border-neutral-50 dark:border-neutral-800">
            {messageType === 'text' && (
              <div>
                <label className="block text-[11px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">Payload Content</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  placeholder="Enter message body here..."
                  className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white focus:bg-white dark:focus:bg-neutral-800 transition-all resize-none text-neutral-900 dark:text-white shadow-sm"
                  required
                />
              </div>
            )}

            {messageType === 'template' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                {/* Template Selector */}
                <div>
                  <label className="block text-[11px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">Approved Template</label>
                  {loadingTemplates ? (
                    <div className="flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-100 dark:border-neutral-700 rounded-2xl text-xs font-bold text-neutral-400">
                      <Loader2 size={14} className="animate-spin" />
                      Fetching cloud templates...
                    </div>
                  ) : (
                    <select
                      value={selectedTemplate?.id || ''}
                      onChange={(e) => {
                        const t = templates.find(t => t.id === e.target.value);
                        if (t) handleSelectTemplate(t);
                      }}
                      className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-bold text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white transition-all cursor-pointer shadow-sm"
                      required
                    >
                      <option value="">Select template registry...</option>
                      {templates
                        .filter(t => t.status === 'APPROVED')
                        .map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.language})
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                {/* Template Variables */}
                {selectedTemplate && templateVariables.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templateVariables.map((val, i) => (
                      <div key={i}>
                        <label className="block text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-2 px-1">{`VAR_{{${i + 1}}}`}</label>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => updateVariable(i, e.target.value)}
                          placeholder="Inject value..."
                          className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-900 dark:text-white shadow-sm"
                          required
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Template Preview */}
                {selectedTemplate && (
                  <div className="p-6 bg-neutral-900 dark:bg-black rounded-2xl border border-neutral-800 shadow-sm">
                    <label className="block text-[9px] font-black text-neutral-500 dark:text-neutral-600 uppercase tracking-widest mb-3">Generation Preview</label>
                    <p className="text-xs text-neutral-300 dark:text-neutral-400 font-medium leading-relaxed whitespace-pre-wrap">{getTemplatePreview()}</p>
                  </div>
                )}
              </div>
            )}

            {(messageType === 'image' || messageType === 'document') && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="p-8 bg-neutral-50 dark:bg-neutral-800/50 border-2 border-dashed border-neutral-200 dark:border-neutral-700 rounded-[2rem] text-center group hover:border-neutral-900 dark:hover:border-white transition-all shadow-sm">
                  <input
                    type="file"
                    id="file-upload"
                    accept={messageType === 'image' ? 'image/*' : '*/*'}
                    onChange={(e) => handleFileChange(e)}
                    className="hidden"
                    required
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="w-12 h-12 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-neutral-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-neutral-900 transition-all shadow-sm">
                      {messageType === 'image' ? <Image size={20} /> : <FileText size={20} />}
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-900 dark:text-neutral-100">
                      {filename || `Select ${messageType}`}
                    </p>
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold mt-1">Maximum payload size: 16MB</p>
                  </label>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">Attachment Caption</label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Enter accompanying text..."
                    className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium text-neutral-900 dark:text-white shadow-sm"
                  />
                </div>
              </div>
            )}

            {messageType === 'location' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">LATITUDE</label>
                    <input
                      type="number"
                      step="any"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="-6.2088"
                      className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-mono font-bold text-neutral-900 dark:text-white shadow-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">LONGITUDE</label>
                    <input
                      type="number"
                      step="any"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="106.8456"
                      className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-mono font-bold text-neutral-900 dark:text-white shadow-sm"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-3 px-1">Location Alias</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Headquarters"
                    className="w-full px-5 py-4 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl text-sm font-medium text-neutral-900 dark:text-white shadow-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-8 border-t border-neutral-100 dark:border-neutral-800 flex items-center gap-4 bg-white dark:bg-neutral-900 sticky bottom-0 transition-colors">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-2xl font-bold text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all uppercase tracking-widest shadow-sm"
          >
            Abort
          </button>
          <button
            onClick={handleSubmit}
            type="submit"
            disabled={loading || (messageType === 'template' && !selectedTemplate)}
            className="flex-2 flex items-center justify-center gap-3 px-10 py-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-2xl font-bold text-sm hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all uppercase tracking-widest disabled:bg-neutral-100 dark:disabled:bg-neutral-800 disabled:text-neutral-400 shadow-md"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? 'Transmitting...' : 'Dispatch Message'}
          </button>
        </div>
      </div>
    </div>
  );
}
