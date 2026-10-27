import { Download, FileUp, ShieldCheck, Upload } from 'lucide-react';
import { useState } from 'react';
import type { AppState } from '@domain/types';
import {recipeJsonFileFits,RECIPE_JSON_SIZE_MESSAGE} from '../import-limits';

interface SettingsProps {
  state: AppState;
  onExport: () => void;
  onRestore: (file: File) => Promise<void>;
  onBankImport: (file: File) => Promise<void>;
}

function isJsonFile(file: File): boolean { return file.type === 'application/json' || file.name.toLowerCase().endsWith('.json'); }

export function Settings({ state, onExport, onRestore, onBankImport }: SettingsProps) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'backup' | 'bank' | null>(null);
  const choose = async (event: React.ChangeEvent<HTMLInputElement>, type: 'backup' | 'bank') => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!isJsonFile(file) || !recipeJsonFileFits(file.size)) { setMessage(RECIPE_JSON_SIZE_MESSAGE); return; }
    setBusy(type); setMessage('');
    try { if (type === 'backup') await onRestore(file); else await onBankImport(file); setMessage(type === 'backup' ? 'Backup restored on this device.' : 'Recipe bank merged into this device.'); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : 'The file could not be imported.'); }
    finally { setBusy(null); }
  };
  return <section className="page settings-page" aria-labelledby="settings-heading"><header className="page-heading"><div><h1 id="settings-heading">Your data</h1><p>Recipes, plans, shopping checks, goals, and food logs live on this device. There are no accounts or cloud sync. YouTube extraction sends only the video link and any source text you explicitly submit.</p></div></header>{message && <p className="toast" role="status">{message}</p>}
    <section className="settings-card"><h2>Backup this device</h2><p>Export the full local state before clearing browser data or moving to another device.</p><button type="button" className="button" onClick={onExport}><Download size={18} /> Download full backup</button><label className={`button button--quiet file-button ${busy ? 'is-disabled' : ''}`}><Upload size={18} /> {busy === 'backup' ? 'Checking backup…' : 'Restore full backup'}<input type="file" accept="application/json,.json" disabled={busy !== null} onChange={event => void choose(event, 'backup')} /></label><p className="field-hint">Restoring replaces the local recipes, plans, shopping checks, targets, and logs after confirmation.</p></section>
    <section className="settings-card"><h2>Import recipe bank</h2><p>Merge a structured JSON recipe collection. Imported IDs are preserved; any matching IDs require a deliberate overwrite confirmation.</p><label className={`button button--quiet file-button ${busy ? 'is-disabled' : ''}`}><FileUp size={18} /> {busy === 'bank' ? 'Checking recipes…' : 'Choose recipe JSON'}<input type="file" accept="application/json,.json" disabled={busy !== null} onChange={event => void choose(event, 'bank')} /></label><p className="field-hint">Current book: {state.recipes.length} recipes. This feature uses only the file you select; it does not connect to a source or a network service.</p></section>
    <section className="settings-card settings-card--subtle"><h2>Offline by default</h2><p>Core planning, shopping, cooking steps and manual organization work offline after this app has been saved by the browser. New YouTube imports need a connection; already-saved recipes do not. The optional self-hosted organizer is not connected.</p><p className="field-hint"><ShieldCheck size={15}/> Keep a JSON backup before switching devices. Backup and recipe JSON imports support up to 32 MB.</p></section>
  </section>;
}
