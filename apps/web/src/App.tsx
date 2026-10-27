import { lazy, Suspense, useState } from 'react';
import { useMealbook } from './useMealbook';
import './boot.css';

// Start fetching the experience chunk while private state/seed data loads.
const experienceModule = import('./experience/MealbookUI');
const MealbookUI = lazy(() => experienceModule.then((module) => ({ default: module.MealbookUI })));

function Opening() {
  return (
    <main className="mealbook-opening" aria-busy="true" aria-label="Opening your recipe book">
      <div className="mealbook-opening__brand">
        <img src="/icon.svg" alt="" width="38" height="38" /> Mealbook
      </div>
      <p>Your next meal, one clear step.</p>
      <div className="mealbook-skeleton" aria-hidden="true">
        <div />
        <span />
        <span />
        <i />
      </div>
      <p className="mealbook-opening__status">Opening today’s recipe…</p>
    </main>
  );
}

export default function App() {
  const app = useMealbook();
  const [restoreError, setRestoreError] = useState('');
  const [restoring, setRestoring] = useState(false);
  if (!app.loaded) return <Opening />;
  if (app.loadError || !app.model)
    return (
      <main className="mealbook-opening mealbook-opening--error">
        <div className="mealbook-opening__brand">
          <img src="/icon.svg" alt="" width="38" height="38" /> Mealbook
        </div>
        <h1>Your book needs attention</h1>
        <p role="alert">{app.loadError || 'The saved recipe book could not be opened.'}</p>
        <p>It has not been reset. Try again, or restore a private JSON backup.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
        <label className="mealbook-recovery">
          <span>{restoring ? 'Restoring…' : 'Restore a backup'}</span>
          <input
            type="file"
            accept=".json,application/json"
            disabled={restoring}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setRestoring(true);
              setRestoreError('');
              try {
                await app.restore(file);
              } catch (error) {
                setRestoreError(
                  error instanceof Error ? error.message : 'The backup could not be restored.',
                );
              } finally {
                setRestoring(false);
                event.target.value = '';
              }
            }}
          />
        </label>
        {restoreError && <p role="alert">{restoreError}</p>}
      </main>
    );
  return (
    <Suspense fallback={<Opening />}>
      <MealbookUI
        model={app.model}
        dispatch={app.dispatch}
        onRestore={app.restore}
        onBankImport={app.importBank}
        onOpenExistingSource={app.openExistingSource}
      />
    </Suspense>
  );
}
