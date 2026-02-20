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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Send Message</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Session Selector (only for internal mode) */}
          {!isOfficial && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              >
                {sessions.filter(s => s.status === 'ready').map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.id} {s.phone && `(${s.phone})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Message Type Tabs */}
          <div className="flex gap-2 flex-wrap">
            {messageTypes
              .filter(t => !t.officialOnly || isOfficial)
              .map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMessageType(id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    messageType === id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To (Phone Number)</label>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="6281234567890"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>

          {/* Dynamic Fields based on type */}
          {messageType === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
          )}

          {messageType === 'template' && (
            <div className="space-y-4">
              {/* Template Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                {loadingTemplates ? (
                  <div className="flex items-center gap-2 py-3 text-sm text-gray-500">
                    <Loader2 size={16} className="animate-spin" />
                    Loading templates...
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-sm text-gray-500 py-2">
                    No templates found.{' '}
                    <button type="button" onClick={loadTemplates} className="text-indigo-600 hover:underline">
                      Retry
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedTemplate?.id || ''}
                    onChange={(e) => {
                      const t = templates.find(t => t.id === e.target.value);
                      if (t) handleSelectTemplate(t);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select a template...</option>
                    {templates
                      .filter(t => t.status === 'APPROVED')
                      .map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.language}) — {t.category}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              {/* Template Variables */}
              {selectedTemplate && templateVariables.length > 0 && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Variables ({templateVariables.length})
                  </label>
                  {templateVariables.map((val, i) => (
                    <div key={i}>
                      <label className="block text-xs text-gray-500 mb-1">{`{{${i + 1}}}`}</label>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => updateVariable(i, e.target.value)}
                        placeholder={`Value for {{${i + 1}}}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        required
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Template Preview */}
              {selectedTemplate && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Preview</label>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{getTemplatePreview()}</p>
                </div>
              )}
            </div>
          )}

          {(messageType === 'image' || messageType === 'document') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
                <input
                  type="file"
                  accept={messageType === 'image' ? 'image/*' : '*/*'}
                  onChange={(e) => handleFileChange(e)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
                {filename && <span className="text-sm text-gray-500">{filename}</span>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Caption (optional)</label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </>
          )}

          {messageType === 'location' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    placeholder="-6.2088"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    placeholder="106.8456"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Monas, Jakarta"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (messageType === 'template' && !selectedTemplate)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send size={18} />
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
