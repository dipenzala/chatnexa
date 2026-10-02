'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Bell, Save, Loader2, Check } from 'lucide-react';
import { api } from '@/lib/api';

export default function NotificationsPage() {
  const { data: org, mutate } = useSWR('/api/v1/org', api.get);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    notify_email: true,
    notify_birthdays: true,
    notify_low_balance: true,
    notify_new_leads: true,
    google_review_url: '',
  });

  useEffect(() => {
    if (org?.organization) {
      setForm({
        notify_email: org.organization.notify_email ?? true,
        notify_birthdays: org.organization.notify_birthdays ?? true,
        notify_low_balance: org.organization.notify_low_balance ?? true,
        notify_new_leads: org.organization.notify_new_leads ?? true,
        google_review_url: org.organization.google_review_url ?? '',
      });
    }
  }, [org]);

  async function save() {
    setBusy(true);
    try {
      await api.patch('/api/v1/org', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      mutate();
    } catch (e: any) { alert(e.message); }
    finally { setBusy(false); }
  }

  const toggles = [
    { key: 'notify_email', label: 'Email Notifications', desc: 'Welcome emails, password reset, low balance alerts' },
    { key: 'notify_birthdays', label: 'Birthday Reminders', desc: 'Daily digest of upcoming birthdays' },
    { key: 'notify_low_balance', label: 'Low Balance Alerts', desc: 'Alert when wallet drops below ₹50' },
    { key: 'notify_new_leads', label: 'New Lead Alerts', desc: 'Real-time notification when new lead arrives' },
  ] as const;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" /> Notifications
        </h1>
        <p className="text-sm text-slate-500 mt-1">Choose what you want to be notified about</p>
      </div>

      <div className="card p-6 space-y-1">
        {toggles.map((t) => (
          <label key={t.key} className="flex items-start gap-3 p-4 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={form[t.key]}
              onChange={(e) => setForm({ ...form, [t.key]: e.target.checked })}
              className="rounded w-4 h-4 mt-0.5"
            />
            <div className="flex-1">
              <div className="font-semibold text-sm">{t.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{t.desc}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="card p-6">
        <label className="label">Google Review URL</label>
        <input
          value={form.google_review_url}
          onChange={(e) => setForm({ ...form, google_review_url: e.target.value })}
          placeholder="https://g.page/r/xxxxx/review"
          className="input"
        />
        <p className="mt-2 text-[11px] text-slate-500">
          Ye URL customers ko review request bhejte waqt use hoga.
        </p>
      </div>

      <button onClick={save} disabled={busy} className="btn-primary">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
