import { useEffect, useMemo, useState } from 'react';
import {
  Globe, Contact, MessageCircle, Mail,
  Phone, ExternalLink, ArrowUpRight, RefreshCw, MapPin, Link
} from 'lucide-react';

type Profile = Record<string, string>;
type Action = {
  key: string; label: string; type: string; value: string;
  enabled: boolean; sort_order: number; icon?: string;
};
type CardData = { success: boolean; profile: Profile; actions: Action[]; error?: string };

const API_URL = import.meta.env.VITE_CARD_API_URL as string;
const CORE_KEYS = new Set(['website', 'save_contact', 'whatsapp']);
const CACHE_KEY = 'codeless_card_v1';
const CACHE_TTL_MS = 60_000;
const WA_GREETING = encodeURIComponent("Hello, I found your contact through your digital business card. I'd like to know more about Codeless Technologies.");

function jsonp(url: string): Promise<CardData> {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('Card API is not configured.'));
    const callbackName = `__codelessCard_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => cleanup(new Error('The card service took too long to respond.')), 12000);
    const cleanup = (error?: Error, data?: CardData) => {
      window.clearTimeout(timeout);
      delete (window as any)[callbackName];
      script.remove();
      if (error) reject(error);
      else if (data?.success) resolve(data);
      else reject(new Error(data?.error || 'Unable to load card details.'));
    };
    (window as any)[callbackName] = (data: CardData) => cleanup(undefined, data);
    script.onerror = () => cleanup(new Error('Could not connect to the card service.'));
    const separator = url.includes('?') ? '&' : '?';
    script.src = `${url}${separator}callback=${callbackName}&_=${Date.now()}`;
    document.body.appendChild(script);
  });
}

function safeHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function whatsappDigits(value: string): string {
  let digits = phoneDigits(value);
  // Indian mobile numbers may be entered as 10 digits or with a leading 0.
  if (digits.length === 10) digits = `91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
  return digits;
}

function escapeVCard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function downloadVCard(profile: Profile) {
  const name = profile.full_name || profile.company_name || 'Contact';
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `FN:${escapeVCard(name)}`,
    `ORG:${escapeVCard(profile.company_name || '')}`,
    `TITLE:${escapeVCard(profile.designation || '')}`,
  ];
  if (profile.phone) lines.push(`TEL;TYPE=CELL:${escapeVCard(profile.phone)}`);
  if (profile.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCard(profile.email)}`);
  if (profile.website && safeHttpUrl(profile.website)) lines.push(`URL:${safeHttpUrl(profile.website)}`);
  if (profile.address) lines.push(`ADR;TYPE=WORK:;;${escapeVCard(profile.address)};;;;`);
  lines.push('END:VCARD');
  const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/vcard;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `${name.replace(/[^a-z0-9-_]+/gi, '-')}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function actionIcon(type: string) {
  switch (type) {
    case 'website': return <Globe size={19} />;
    case 'vcard': return <Contact size={19} />;
    case 'whatsapp': return <MessageCircle size={19} />;
    case 'email': return <Mail size={19} />;
    case 'phone': return <Phone size={19} />;
    case 'linkedin': return <Link size={19} />;
    default: return <ExternalLink size={19} />;
  }
}

export default function App() {
  const [data, setData] = useState<CardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, payload } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL_MS) { setData(payload); setLoading(false); return; }
      }
      const payload = await jsonp(API_URL);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), payload }));
      setData(payload);
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load card.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const actions = useMemo(() => data?.actions || [], [data]);
  const reservedEnabled = (key: string) => {
    const row = actions.find(a => a.key === key);
    return row ? row.enabled : true;
  };
  const optionalActions = actions.filter(a => !CORE_KEYS.has(a.key));

  const openAction = (action: Action) => {
    const value = action.value;
    if (action.type === 'email') {
      if (value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) window.location.href = `mailto:${value}`;
      return;
    }
    if (action.type === 'phone') {
      const digits = phoneDigits(value);
      if (digits) window.location.href = `tel:${digits}`;
      return;
    }
    if (action.type === 'whatsapp') {
      const digits = whatsappDigits(value);
      if (digits) window.open(`https://wa.me/${digits}?text=${WA_GREETING}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (action.type === 'vcard') {
      if (data?.profile) downloadVCard(data.profile);
      return;
    }
    const target = safeHttpUrl(value);
    if (target) window.open(target, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <main className="shell"><div className="state"><div className="spinner" /><p>Loading digital business card…</p></div></main>;
  if (error || !data) return <main className="shell"><div className="state"><div className="brand-mark">C</div><h1>Card temporarily unavailable</h1><p>{error || 'Please try again.'}</p><button className="retry" onClick={load}><RefreshCw size={16}/> Try again</button></div></main>;

  const p = data.profile || {};
  const website = p.website || actions.find(a => a.key === 'website')?.value || '';
  const whatsapp = p.phone || actions.find(a => a.key === 'whatsapp')?.value || '';
  const validWebsite = safeHttpUrl(website);
  const whatsappNumber = whatsappDigits(whatsapp);

  return (
    <main className="shell">
      <section className="card">
        <div className="topline">
          <span className="brand-wordmark">CODELESS <b>TECHNOLOGIES</b></span>
        </div>
        <div className="profile">
          <p className="eyebrow">AI & SOFTWARE SOLUTIONS</p>
          <h1>{p.company_name || 'Codeless Technologies'}</h1>
          {p.tagline && <p className="tagline">{p.tagline}</p>}
          {p.address && <p className="address"><MapPin size={14}/>{p.address}</p>}
        </div>

        <div className="primary-actions">
          {reservedEnabled('website') && validWebsite && <button className="action primary" onClick={() => window.open(validWebsite, '_blank', 'noopener,noreferrer')}><Globe/><span>Visit Website</span><ArrowUpRight className="end-icon"/></button>}
          {reservedEnabled('save_contact') && <button className="action primary" onClick={() => downloadVCard(p)}><Contact/><span>Save Contact</span><ArrowUpRight className="end-icon"/></button>}
          {reservedEnabled('whatsapp') && whatsappNumber && <button className="action whatsapp" onClick={() => window.open(`https://wa.me/${whatsappNumber}?text=${WA_GREETING}`, '_blank', 'noopener,noreferrer')}><MessageCircle/><span>Connect on WhatsApp</span><ArrowUpRight className="end-icon"/></button>}
        </div>

        {optionalActions.length > 0 && <div className="more-actions"><p className="section-label">CONNECT & EXPLORE</p>{optionalActions.map(a => <button key={a.key} className="action secondary" onClick={() => openAction(a)}>{actionIcon(a.type)}<span>{a.label}</span><ArrowUpRight className="end-icon"/></button>)}</div>}

        <footer><span>Building Intelligent Digital Solutions.</span><a href={validWebsite || '#'} target="_blank" rel="noreferrer">Codeless Technologies</a></footer>
      </section>
      <p className="bottom-note">Digital business card · Codeless Technologies</p>
    </main>
  );
}
