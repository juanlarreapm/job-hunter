'use client';

import { useEffect, useState } from 'react';

interface OutreachMessage {
  id: number;
  job_id: number | null;
  recipient_name: string | null;
  recipient_title: string | null;
  recipient_type: string | null;
  message_type: string | null;
  message_text: string | null;
  status: string;
  created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function MessageCard({ msg }: { msg: OutreachMessage }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!msg.message_text) return;
    navigator.clipboard.writeText(msg.message_text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const typeLabel = msg.message_type?.replace('_', ' ') ?? 'message';
  const charCount = msg.message_text?.length ?? 0;
  const charLimit = msg.message_type === 'connection_request' ? 280 : msg.message_type === 'follow_up' ? 500 : 1900;

  return (
    <div className="border border-zinc-800 rounded-lg p-4 bg-zinc-900/40">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-medium text-zinc-200">
            {msg.recipient_name ?? 'Unknown Recipient'}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {msg.recipient_title} · <span className="capitalize">{typeLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs ${charCount > charLimit ? 'text-red-400' : 'text-zinc-600'}`}>
            {charCount}/{charLimit}
          </span>
          <button
            onClick={copy}
            className="text-xs px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Message */}
      <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-950 rounded p-3 border border-zinc-800">
        {msg.message_text ?? '—'}
      </p>
    </div>
  );
}

export default function OutreachPage() {
  const [messages, setMessages] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/outreach`)
      .then(r => r.json())
      .then(d => setMessages(d.messages ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Outreach</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Draft messages ready to send</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-zinc-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-zinc-800 rounded w-40 mb-2" />
              <div className="h-16 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-600 text-sm">No outreach messages yet.</p>
          <p className="text-zinc-700 text-xs mt-1">
            Generate outreach from a job detail page.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(msg => <MessageCard key={msg.id} msg={msg} />)}
        </div>
      )}
    </div>
  );
}
