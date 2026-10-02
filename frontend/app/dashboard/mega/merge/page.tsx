'use client';
import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { GitMerge, ArrowLeft, Loader2, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';

export default function Page() {
  const { data, mutate, isLoading } = useSWR('/api/v1/mega/contacts/duplicates', api.get, { refreshInterval: 20000 });
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-5 max-w-5xl">
      <Link href="/dashboard/mega" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <GitMerge className="w-6 h-6 text-primary" /> Contact Merge
          </h1>
        </div>
        <button onClick={() => mutate()} className="btn-secondary"><RefreshCw className="w-4 h-4" /> Refresh</button>
      </div>
      <div className="card p-8 text-center">
        {isLoading ? (
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
        ) : (
          <>
            <GitMerge className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <div className="text-sm text-slate-500">Find & merge duplicate contacts</div>
            <pre className="mt-4 text-[10px] text-slate-400 overflow-auto max-h-60 text-left">{JSON.stringify(data, null, 2)}</pre>
          </>
        )}
      </div>
    </div>
  );
}
