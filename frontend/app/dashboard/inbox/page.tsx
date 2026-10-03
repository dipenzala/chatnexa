'use client';
import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
  Send, Search, Loader2, Bot, Sparkles, Phone, Mail, Tag, User,
  MessageSquare, Calendar, DollarSign, ChevronDown, ChevronRight, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

const TABS = ['ACTIVE', 'REQUESTING', 'INTERVENED'] as const;

export default function InboxPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('ACTIVE');
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showProfile, setShowProfile] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: convData, mutate: mutateConv } = useSWR(
    `/api/v1/inbox/conversations?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    api.get, { refreshInterval: 8000 }
  );

  const { data: msgData, mutate: mutateMsgs } = useSWR(
    selected ? `/api/v1/inbox/conversations/${selected}/messages` : null,
    api.get, { refreshInterval: 5000 }
  );

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

  const conv = msgData?.conversation;
  const conversations = convData?.conversations || [];

  return (
    <div className="h-[calc(100vh-8.5rem)] flex gap-0 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      {/* Column 1: Contact List */}
      <div className="w-full sm:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or mobile number"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-10 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors relative ${
                tab === t ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t} ({t === 'ACTIVE' ? conversations.length : 0})
              {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
            </button>
          ))}
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`w-full text-left p-4 border-b border-slate-100 transition-colors ${
                selected === c.id ? 'bg-emerald-50 border-l-2 border-emerald-500' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center text-white text-sm font-bold shrink-0">
                  {(c.contact_name || c.contact_phone || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm truncate">{c.contact_name || c.contact_phone}</span>
                    {c.unread_count > 0 && (
                      <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold grid place-items-center">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{c.last_message || 'No messages yet'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400">
                      {new Date(c.last_message_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
          {!conversations.length && (
            <div className="p-12 text-center">
              <MessageSquare className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">No conversations yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Column 2: Chat */}
      <div className="hidden md:flex flex-1 flex-col min-w-0 bg-slate-50">
        {!selected ? (
          <div className="flex-1 grid place-items-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 grid place-items-center mx-auto mb-4">
                <MessageSquare className="w-7 h-7 text-emerald-500" />
              </div>
              <h3 className="font-bold text-lg">Select a conversation</h3>
              <p className="text-sm text-slate-500 mt-1">Choose a chat to start replying</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-16 px-5 bg-white border-b border-slate-200 flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center text-white text-sm font-bold">
                {(conv?.contact_name || conv?.contact_phone || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm truncate">{conv?.contact_name || conv?.contact_phone}</div>
                <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </div>
              </div>
              <button onClick={() => setShowProfile(!showProfile)} className="p-2 rounded-lg hover:bg-slate-100" title="Toggle profile">
                <User className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#f5f7fa]">
              {msgData?.messages?.map((m: any) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    m.direction === 'outbound'
                      ? 'bg-emerald-500 text-white rounded-br-md'
                      : 'bg-white text-slate-800 rounded-bl-md border border-slate-200'
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{m.body || `[${m.type}]`}</p>
                    <div className={`flex items-center gap-1.5 mt-1 text-[10px] ${
                      m.direction === 'outbound' ? 'text-white/70' : 'text-slate-400'
                    }`}>
                      {m.ai_generated && <Bot className="w-3 h-3" />}
                      {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      {m.direction === 'outbound' && <span>· {m.status}</span>}
                    </div>
                  </div>
                </motion.div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <form onSubmit={send} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              <button type="submit" disabled={sending || !text.trim()} className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-3 font-semibold disabled:opacity-50 transition-colors">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Column 3: Profile */}
      {selected && showProfile && (
        <div className="hidden lg:flex w-80 bg-white border-l border-slate-200 flex-col shrink-0">
          <div className="p-5 border-b border-slate-100 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center text-white text-2xl font-bold mx-auto shadow-lg">
              {(conv?.contact_name || conv?.contact_phone || '?').charAt(0).toUpperCase()}
            </div>
            <div className="mt-3 font-bold">{conv?.contact_name || 'Unknown'}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">+{conv?.contact_phone || '—'}</div>
          </div>

          {/* Info sections */}
          <div className="flex-1 overflow-y-auto">
            <ProfileSection title="Details" icon={User}>
              <ProfileRow label="Status" value={conv?.status || 'Active'} />
              <ProfileRow label="Last Active" value={conv?.last_message_at ? new Date(conv.last_message_at).toLocaleString('en-IN') : '—'} />
              <ProfileRow label="Unread" value={String(conv?.unread_count || 0)} />
            </ProfileSection>

            <ProfileSection title="Tags" icon={Tag}>
              <div className="flex flex-wrap gap-1.5">
                {(conv?.tags || []).map((t: string) => (
                  <span key={t} className="text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{t}</span>
                ))}
                {!conv?.tags?.length && <span className="text-xs text-slate-400">No tags</span>}
              </div>
            </ProfileSection>

            <ProfileSection title="Actions" icon={DollarSign}>
              <div className="space-y-2">
                <button className="w-full text-left rounded-lg hover:bg-slate-50 px-3 py-2 text-sm flex items-center justify-between">
                  <span>Send Payment Link</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
                <button className="w-full text-left rounded-lg hover:bg-slate-50 px-3 py-2 text-sm flex items-center justify-between">
                  <span>Schedule Follow-up</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
                <button className="w-full text-left rounded-lg hover:bg-slate-50 px-3 py-2 text-sm flex items-center justify-between">
                  <span>Add to Campaign</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </ProfileSection>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-slate-100">
      <button onClick={() => setOpen(!open)} className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <Icon className="w-3.5 h-3.5" />
          {title}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800 text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}
