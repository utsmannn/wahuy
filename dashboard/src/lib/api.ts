const API_BASE = '/api';

function getApiKey(): string {
  return localStorage.getItem('apiKey') || '';
}

export function setApiKey(key: string): void {
  localStorage.setItem('apiKey', key);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'X-API-Key': getApiKey(),
  };

  // Only set Content-Type if there's a body
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Request failed');
  }

  return data;
}

export const api = {
  // Sessions
  getSessions: () => request<{ success: boolean; data: import('../types').Session[] }>('/sessions'),
  getSession: (id: string) => request<{ success: boolean; data: import('../types').Session }>(`/sessions/${id}`),
  createSession: (data: { id?: string; name?: string }) =>
    request<{ success: boolean; data: import('../types').Session }>('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteSession: (id: string) => request<{ success: boolean }>(`/sessions/${id}`, { method: 'DELETE' }),
  startSession: (id: string) => request<{ success: boolean }>(`/sessions/${id}/start`, { method: 'POST' }),
  stopSession: (id: string) => request<{ success: boolean }>(`/sessions/${id}/stop`, { method: 'POST' }),
  logoutSession: (id: string) => request<{ success: boolean }>(`/sessions/${id}/logout`, { method: 'POST' }),
  getQR: (id: string) => request<{ success: boolean; data: { qr: string } }>(`/sessions/${id}/qr`),

  // Webhooks
  getWebhooks: () => request<{ success: boolean; data: import('../types').Webhook[] }>('/webhooks'),
  createWebhook: (data: Partial<import('../types').Webhook>) =>
    request<{ success: boolean; data: import('../types').Webhook }>('/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateWebhook: (id: string, data: Partial<import('../types').Webhook>) =>
    request<{ success: boolean; data: import('../types').Webhook }>(`/webhooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteWebhook: (id: string) => request<{ success: boolean }>(`/webhooks/${id}`, { method: 'DELETE' }),
  testWebhook: (id: string) => request<{ success: boolean; data: { statusCode: number; responseTime: number } }>(`/webhooks/${id}/test`, { method: 'POST' }),

  // Messages
  sendMessage: (sessionId: string, to: string, text: string) =>
    request<{ success: boolean; data: { messageId: string } }>(`/sessions/${sessionId}/messages/send`, {
      method: 'POST',
      body: JSON.stringify({ to, text }),
    }),
  sendImage: (sessionId: string, to: string, base64Data: string, mimeType: string, caption?: string, filename?: string) =>
    request<{ success: boolean; data: { messageId: string } }>(`/sessions/${sessionId}/messages/send-image`, {
      method: 'POST',
      body: JSON.stringify({ to, base64Data, mimeType, caption, filename }),
    }),
  sendDocument: (sessionId: string, to: string, base64Data: string, mimeType: string, filename: string, caption?: string) =>
    request<{ success: boolean; data: { messageId: string } }>(`/sessions/${sessionId}/messages/send-document`, {
      method: 'POST',
      body: JSON.stringify({ to, base64Data, mimeType, filename, caption }),
    }),
  sendLocation: (sessionId: string, to: string, latitude: number, longitude: number, description?: string) =>
    request<{ success: boolean; data: { messageId: string } }>(`/sessions/${sessionId}/messages/send-location`, {
      method: 'POST',
      body: JSON.stringify({ to, latitude, longitude, description }),
    }),

  // Health
  getHealth: () => request<import('../types').HealthResponse>('/health'),
};
