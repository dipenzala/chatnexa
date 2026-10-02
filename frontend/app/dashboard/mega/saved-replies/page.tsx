'use client';
import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { MessageSquare, ArrowLeft, Loader2, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

export default function Page() {
  const { data, mutate, isLoading } = useSWR('/api/v1/mega/saved-replies', api.get, { refreshInterval: 20000 });
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-5 max-w-5xl">
      <Link href="/dashboard/mega" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" /> Saved Replies
          </h1>
        </div>
        <button onClick={() => mutate()} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>
      <div className="card p-8 text-center">
        {isLoading ? (
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
        ) : (
          <>
            <MessageSquare className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <div className="text-sm text-slate-500">Save frequently used replies</div>
            <pre className="mt-4 text-[10px] text-slate-400 overflow-auto max-h-60 text-left">{JSON.stringify(data, null, 2)}</pre>
          </>
        )}
      </div>
    </div>
  );
}
