'use client';
import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { Send, Search, Loader2, Bot, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

export default function Inbox() {
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [summary, setSummary] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: convData, mutate: mutateConv } = useSWR(`/api/v1/inbox/conversations?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`, api.get, { refreshInterval: 10000 });
  const { data: msgData, mutate: mutateMsgs } = useSWR(selected ? `/api/v1/inbox/conversations/${selected}/messages` : null, api.get, { refreshInterval: 5000 });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNew = () => { mutateConv(); if (selected) mutateMsgs(); };
    socket.on('message:new', onNew);
    socket.on('message:status', onNew);
    return () => { socket.off('message:new', onNew); socket.off('message:status', onNew); };
  }, [selected, mutateConv, mutateMsgs]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgData?.messages?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !selected) return;
    setSending(true);
    try {
      await api.post(`/api/v1/inbox/conversations/${selected}/messages`, { text, type: 'text' });
      setText(''); mutateMsgs(); mutateConv();
    } catch (err: any) { alert(err.message); }
    finally { setSending(false); }
  }

  async function getSummary() {
    if (!selected) return;
    setSummary('Generating…');
    try { const res = await api.post(`/api/v1/inbox/conversations/${selected}/summary`, {}); setSummary(res.summary); }
    catch (err: any) { setSummary(`⚠️ ${err.message}`); }
  }

  const conv = msgData?.conversation;

  return (
    <div className="h-[calc(100vh-8.5rem)] flex gap-4">
      <div className="w-full sm:w-80 lg:w-[340px] card flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-200/80">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" className="input pl-10 py-2 text-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convData?.conversations?.map((c: any) => (
            <button key={c.id} onClick={() => { setSelected(c.id); setSummary(''); }} className={`w-full text-left p-3.5 border-b border-slate-100 transition-colors ${selected === c.id ? 'bg-primary-50' : 'hover:bg-slate-50'}`}>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-mint grid place-items-center text-white text-xs font-bold shrink-0">{(c.contact_name || c.contact_phone).charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">{c.contact_name || c.contact_phone}</span>
                    {c.unread_count > 0 && <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold grid place-items-center">{c.unread_count}</span>}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{c.last_message || 'No messages yet'}</p>
                </div>
              </div>
            </button>
          ))}
          {!convData?.conversations?.length && <div className="p-8 text-center text-sm text-slate-400">No conversations yet</div>}
        </div>
      </div>

      <div className="hidden sm:flex flex-1 card flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 grid place-items-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 grid place-items-center mx-auto"><Send className="w-7 h-7 text-slate-300" /></div>
              <h3 className="mt-4 font-bold">Select a conversation</h3>
              <p className="text-sm text-slate-500 mt-1">Choose a chat from the list to start replying.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-16 px-5 border-b border-slate-200/80 flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-mint grid place-items-center text-white text-xs font-bold">{(conv?.contact_name || conv?.contact_phone || '?').charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm truncate">{conv?.contact_name || conv?.contact_phone}</div>
                <div className="text-[11px] text-slate-500 font-mono">{conv?.contact_phone}</div>
              </div>
              <button onClick={getSummary} className="btn-secondary py-1.5 px-3 text-xs"><Sparkles className="w-3.5 h-3.5" /> AI summary</button>
            </div>

            {summary && (
              <div className="px-5 py-3 bg-mint-50 border-b border-mint-100 text-xs text-slate-700 whitespace-pre-wrap">
                {summary}
                <button onClick={() => setSummary('')} className="ml-2 text-mint-600 font-semibold hover:underline">dismiss</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/40">
              {msgData?.messages?.map((m: any) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-soft ${m.direction === 'outbound' ? 'bg-primary text-white rounded-br-md' : 'bg-white text-ink rounded-bl-md border border-slate-200/80'}`}>
                    {m.media_url && <a href={m.media_url} target="_blank" rel="noreferrer" className="block mb-2 text-xs underline opacity-90">📎 {m.type}</a>}
                    <p className="whitespace-pre-wrap break-words">{m.body || `[${m.type}]`}</p>
                    <div className={`flex items-center gap-1.5 mt-1.5 text-[10px] ${m.direction === 'outbound' ? 'text-white/70' : 'text-slate-400'}`}>
                      {m.ai_generated && <Bot className="w-3 h-3" />}
                      {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {m.direction === 'outbound' && <span>· {m.status}</span>}
                    </div>
                  </div>
                </motion.div>
              ))}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="p-3 border-t border-slate-200/80 flex items-center gap-2 shrink-0">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" className="input flex-1 py-2.5" />
              <button type="submit" disabled={sending || !text.trim()} className="btn-primary px-4 py-2.5">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
