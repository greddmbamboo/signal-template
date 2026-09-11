"use client";
import { useEffect, useState } from 'react';
import { version } from '../package.json';
import { checkForUpdate, isNewerVersion, UPDATE_GUIDE_URL, type SignalRelease } from '../lib/updates';
export function UpdateNotice() {
  const [release, setRelease] = useState<SignalRelease | null>(null);
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let disposed = false;
    let active: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function check() {
      active?.abort();
      active = new AbortController();
      timer = setTimeout(() => active?.abort(), 8000);
      setStatus('checking');
      try {
        const next = await checkForUpdate(active.signal);
        if (!disposed) { setRelease(next); setStatus('ok'); }
      } catch { if (!disposed) setStatus('error'); }
      finally { clearTimeout(timer); }
    }
    void check();
    const interval = setInterval(() => { void check(); }, 6 * 60 * 60 * 1000);
    return () => { disposed = true; active?.abort(); clearTimeout(timer); clearInterval(interval); };
  }, [attempt]);
  const update = release && isNewerVersion(release.version, version);
  const prompt = `Please update my existing Signal app using ${UPDATE_GUIDE_URL}. Preserve my data, hosting settings, secrets, and custom changes. Walk me through anything you need me to do.`;
  return <section className="drawer-note" aria-label="Signal updates">
    {update ? <>
      <p role="status"><strong>A Signal update is available: {release.version}</strong></p>
      <p><a href={release.notesUrl} target="_blank" rel="noopener noreferrer">See what’s new</a> · <a href={UPDATE_GUIDE_URL} target="_blank" rel="noopener noreferrer">Get update instructions</a></p>
      <p>Give this message to Codex or Claude Code in your Signal project:</p>
      <textarea aria-label="Message for your assistant" readOnly value={prompt} rows={3} style={{width:'100%'}} onFocus={e=>e.target.select()} />
      <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(prompt);setCopied(true);}catch{setCopied(false);}}}>{copied ? 'Copied' : 'Copy update message'}</button>
      <p>Your app stays on its current version until you choose to update.</p>
    </> : <p role="status">Signal {version} · {status === 'checking' ? 'Checking for updates…' : status === 'error' ? 'Could not check for updates. Your app is still available.' : 'No newer release available.'}</p>}
    <button type="button" disabled={status === 'checking'} onClick={()=>setAttempt(n=>n+1)}>Check for updates</button>
  </section>;
}
