'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface EstimateSummary {
  id: string;
  client_id: string;
  title: string;
  region: string;
  currency: string;
  created_at: string;
}

interface Estimate extends EstimateSummary {
  raw_input: Record<string, unknown>;
  analysis: Record<string, unknown>;
  mappings: unknown[];
  cost_result: Record<string, unknown>;
}

export default function ClientDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [estimates, setEstimates] = useState<EstimateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [clientRes, estimatesRes] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/estimates?clientId=${clientId}`),
      ]);
      if (clientRes.ok) setClient(await clientRes.json());
      else { router.push('/clients'); return; }
      if (estimatesRes.ok) setEstimates(await estimatesRes.json());
    } finally {
      setLoading(false);
    }
  }, [clientId, router]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    if (status === 'authenticated') fetchData();
  }, [status, router, fetchData]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete estimate "${title}"?`)) return;
    await fetch(`/api/estimates/${id}`, { method: 'DELETE' });
    setEstimates(e => e.filter(x => x.id !== id));
  };

  const handleLoad = async (id: string) => {
    const res = await fetch(`/api/estimates/${id}`);
    if (!res.ok) return;
    const estimate: Estimate = await res.json();
    // Store in sessionStorage for the main page to pick up
    sessionStorage.setItem('loadEstimate', JSON.stringify(estimate));
    router.push('/');
  };

  const formatCurrency = (currency: string) => currency === 'SEK' ? 'kr' : currency;

  const getCostSummary = (estimate: EstimateSummary) => {
    // We only have summary here — show region + currency
    return `${estimate.region} · ${formatCurrency(estimate.currency)}`;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/clients" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
          ← Back to Clients
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{client?.name}</h1>
            {client?.description && (
              <p className="text-gray-500 text-sm mt-1">{client.description}</p>
            )}
          </div>
          <Link
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New Estimate
          </Link>
        </div>
      </div>

      {estimates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📊</div>
          <p className="font-medium">No estimates yet</p>
          <p className="text-sm mt-1">Run a calculation and save it to this client</p>
          <Link
            href="/"
            className="inline-block mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Go to calculator →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          <p className="text-sm text-gray-500">{estimates.length} estimate{estimates.length !== 1 ? 's' : ''}</p>
          {estimates.map(estimate => (
            <div key={estimate.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{estimate.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{getCostSummary(estimate)}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(estimate.created_at).toLocaleString('sv-SE')}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleLoad(estimate.id)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Load →
                  </button>
                  <button
                    onClick={() => handleDelete(estimate.id, estimate.title)}
                    className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
