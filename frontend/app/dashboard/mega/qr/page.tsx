'use client';
import { useState } from 'react';
import Link from 'next/link';
import { QrCode, ArrowLeft, Loader2, Download } from 'lucide-react';
import { api } from '@/lib/api';

export default function QRPage() {
  const [form, setForm] = useState({ upiId: '', amount: '', name: '', note: '' });
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);

  async function generate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const res = await api.post('/api/v1/mega/upi/qr', { ...form, amount: Number(form.amount) });
      setQr(res.qr);
    } catch (err: any) { alert(err.message); }
    finally { setBusy(false); }
  }

  function download() {
    const a = document.createElement('a');
    a.href = qr; a.download = `upi-qr-${Date.now()}.png`; a.click();
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <Link href="/dashboard/mega" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <QrCode className="w-6 h-6 text-primary" /> UPI QR Code
        </h1>
        <p className="text-sm text-slate-500 mt-1">Generate instant payment QR — customer pays in 1 tap</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <form onSubmit={generate} className="card p-5 space-y-3">
          <div><label className="label">UPI ID</label><input required value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} placeholder="yourname@paytm" className="input" /></div>
          <div><label className="label">Amount (₹)</label><input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input" /></div>
          <div><label className="label">Payee Name</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></div>
          <div><label className="label">Note (optional)</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input" /></div>
          <button type="submit" disabled={busy} className="btn-primary w-full">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Generate</button>
        </form>
        <div className="card p-5 flex flex-col items-center justify-center min-h-[300px]">
          {qr ? (
            <>
              <img src={qr} alt="UPI QR" className="w-64 h-64" />
              <button onClick={download} className="btn-primary mt-4"><Download className="w-4 h-4" /> Download</button>
            </>
          ) : (
            <div className="text-center text-slate-400 text-sm">QR appears here</div>
          )}
        </div>
      </div>
    </div>
  );
}
