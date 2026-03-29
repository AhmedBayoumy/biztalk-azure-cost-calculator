'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface Client {
  id: string;
  name: string;
}

interface SaveEstimatePanelProps {
  analysis: Record<string, unknown>;
  mappings: unknown[];
  costResult: Record<string, unknown>;
  rawInput?: Record<string, unknown>;
  region: string;
  currency: string;
}

export function SaveEstimatePanel({
  analysis,
  mappings,
  costResult,
  rawInput,
  region,
  currency,
}: SaveEstimatePanelProps) {
  const { data: session } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch('/api/clients')
      .then(r => r.ok ? r.json() : [])
      .then(setClients);
  }, [session]);

  if (!session) {
    return (
      <div className="border rounded-xl p-5 bg-gray-50 text-center">
        <p className="text-sm text-gray-600 mb-3">Sign in with GitHub to save this estimate</p>
        <a
          href="/auth/signin"
          className="inline-block bg-gray-900 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          Sign in to save
        </a>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="border rounded-xl p-5 bg-green-50 border-green-200 text-center">
        <div className="text-2xl mb-2">✅</div>
        <p className="text-sm text-green-700 font-medium">Estimate saved!</p>
        <a href="/clients" className="text-xs text-green-600 hover:underline mt-1 block">
          View in Clients →
        </a>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');

    try {
      let clientId = selectedClientId;

      // Create new client if needed
      if (showNewClient) {
        if (!newClientName.trim()) { setError('Client name is required'); setSaving(false); return; }
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newClientName }),
        });
        if (!res.ok) { setError('Failed to create client'); setSaving(false); return; }
        const client = await res.json();
        clientId = client.id;
      }

      if (!clientId) { setError('Select or create a client'); setSaving(false); return; }

      const res = await fetch('/api/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          title: title.trim(),
          region,
          currency,
          raw_input: rawInput ?? {},
          analysis,
          mappings,
          cost_result: costResult,
        }),
      });

      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed to save'); return; }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-xl p-5 bg-white shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <span>💾</span> Save Estimate
      </h3>

      <form onSubmit={handleSave} className="space-y-4">
        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Initial estimate Q1 2025"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Client *</label>
            <button
              type="button"
              onClick={() => { setShowNewClient(f => !f); setSelectedClientId(''); }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {showNewClient ? 'Pick existing' : '+ New client'}
            </button>
          </div>

          {showNewClient ? (
            <input
              type="text"
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              placeholder="Client name..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          {saving ? 'Saving...' : 'Save Estimate'}
        </button>
      </form>
    </div>
  );
}
