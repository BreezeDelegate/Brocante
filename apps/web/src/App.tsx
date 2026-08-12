import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  allProvidersFailed,
  providerErrorLabel,
  shouldPauseBatch,
  shouldProcessInBatch,
} from './analysis';
import { activeProviders, apiErrorKind, identify, search } from './api';
import { estimate } from './estimate';
import { captureVideoFrame, compressImage } from './image';
import {
  clearScans,
  defaults,
  deleteScan,
  loadPreferences,
  loadScans,
  putScan,
  savePreferences,
} from './storage';
import type { Preferences, ProviderId, Scan } from './types';

const providerNames: Record<ProviderId, string> = {
  vinted: 'Vinted',
  leboncoin: 'Leboncoin',
  ebay: 'eBay',
};

function newScan(image: string): Scan {
  return {
    id: crypto.randomUUID(),
    image,
    label: '',
    status: 'draft',
    createdAt: Date.now(),
    listings: [],
  };
}

export function App() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [scans, setScans] = useState<Scan[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterEnabled, setFilterEnabled] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [batchRunning, setBatchRunning] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const inFlight = useRef(new Set<string>());
  const persistence = useRef(new Map<string, Promise<void>>());

  useEffect(() => {
    void loadScans().then((storedScans) => {
      setScans(storedScans);
      setLoadingHistory(false);
    });
  }, []);

  useEffect(() => savePreferences(preferences), [preferences]);
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const visibleScans = useMemo(
    () =>
      scans.filter(
        (scan) =>
          !filterEnabled ||
          scan.status !== 'done' ||
          (scan.estimate?.floor ?? 0) >= preferences.minimumValue,
      ),
    [filterEnabled, preferences.minimumValue, scans],
  );
  const hasProcessing = scans.some((scan) => scan.status === 'processing');

  function queuePersistence(id: string, work: () => Promise<void>): void {
    const previous = persistence.current.get(id) ?? Promise.resolve();
    const queued = previous
      .catch(() => undefined)
      .then(work)
      .catch(() => undefined);
    persistence.current.set(id, queued);
    void queued.then(() => {
      if (persistence.current.get(id) === queued) persistence.current.delete(id);
    });
  }

  function persistScan(scan: Scan): void {
    queuePersistence(scan.id, () => putScan(scan));
  }

  function storeScan(scan: Scan): void {
    setScans((current) => [scan, ...current.filter((item) => item.id !== scan.id)]);
    persistScan(scan);
  }

  function patchScan(id: string, patch: Partial<Scan>): void {
    setScans((current) =>
      current.map((scan) => {
        if (scan.id !== id) return scan;
        const updated = { ...scan, ...patch };
        persistScan(updated);
        return updated;
      }),
    );
  }

  async function openCamera(): Promise<void> {
    setCameraError('');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (!video.current || !stream.current) return;
        video.current.srcObject = stream.current;
        void video.current.play();
      });
    } catch {
      setCameraError(
        'Caméra inaccessible. Utilise Importer ou autorise la caméra dans Safari/Chrome.',
      );
    }
  }

  function closeCamera(): void {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCameraOpen(false);
  }

  function capture(): void {
    if (!video.current) return;
    const image = captureVideoFrame(video.current);
    if (!image) return;
    storeScan(newScan(image));
    navigator.vibrate?.(25);
  }

  async function addFiles(files: FileList | null): Promise<void> {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        storeScan(newScan(await compressImage(file)));
      } catch {
        // Ignore unreadable files and continue importing the rest.
      }
    }
    if (fileInput.current) fileInput.current.value = '';
  }

  async function run(scan: Scan): Promise<boolean> {
    if (inFlight.current.has(scan.id)) return true;

    const providers = activeProviders(preferences);
    if (providers.length === 0) {
      patchScan(scan.id, {
        status: 'error',
        errorKind: 'configuration',
        error: 'Active au moins une source.',
      });
      return false;
    }

    inFlight.current.add(scan.id);
    patchScan(scan.id, {
      status: 'processing',
      error: undefined,
      errorKind: undefined,
      providerErrors: undefined,
      lastAttemptAt: Date.now(),
    });

    try {
      let label = scan.label.trim();
      if (!label) label = await identify(preferences, scan.image);
      if (!label) {
        patchScan(scan.id, {
          status: 'draft',
          errorKind: undefined,
          error: 'Ajoute un nom ou active Ollama sur le serveur.',
        });
        return true;
      }

      patchScan(scan.id, { label });
      const result = await search(preferences, label, providers);
      if (allProvidersFailed(result.errors, providers) && result.listings.length === 0) {
        patchScan(scan.id, {
          status: 'error',
          errorKind: 'transient',
          providerErrors: result.errors,
          error: 'Aucune source n’a pu répondre. La file est mise en pause.',
        });
        return false;
      }

      patchScan(scan.id, {
        listings: result.listings,
        estimate: estimate(result.listings),
        providerErrors: result.errors.length ? result.errors : undefined,
        status: 'done',
        error: undefined,
        errorKind: undefined,
      });
      return true;
    } catch (error) {
      const errorKind = apiErrorKind(error);
      patchScan(scan.id, {
        status: 'error',
        errorKind,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      });
      return !shouldPauseBatch(errorKind);
    } finally {
      inFlight.current.delete(scan.id);
    }
  }

  async function runPending(): Promise<void> {
    if (batchRunning) return;
    setBatchRunning(true);
    try {
      for (const scan of scans.filter(shouldProcessInBatch)) {
        if (inFlight.current.has(scan.id)) continue;
        const shouldContinue = await run(scan);
        if (!shouldContinue) break;
      }
    } finally {
      setBatchRunning(false);
    }
  }

  function moveProvider(id: ProviderId, direction: -1 | 1): void {
    const order = [...preferences.providerOrder];
    const index = order.indexOf(id);
    const destination = index + direction;
    if (destination < 0 || destination >= order.length) return;
    [order[index], order[destination]] = [order[destination]!, order[index]!];
    setPreferences({ ...preferences, providerOrder: order });
  }

  function removeScan(id: string): void {
    setScans((current) => current.filter((scan) => scan.id !== id));
    queuePersistence(id, () => deleteScan(id));
  }

  async function clearHistory(): Promise<void> {
    if (batchRunning || hasProcessing) return;
    await Promise.all(persistence.current.values());
    setScans([]);
    await clearScans().catch(() => undefined);
    persistence.current.clear();
  }

  return (
    <main>
      <header>
        <div>
          <div className="eyebrow">chine intelligente</div>
          <h1>
            Brocante<span>.</span>
          </h1>
        </div>
        <button className="icon" onClick={() => setSettingsOpen(true)} aria-label="Réglages">
          <Settings />
        </button>
      </header>

      <section className="hero">
        <p>Photographie d'abord. Trie ce qui vaut le détour ensuite.</p>
        <div className="actions">
          <button className="primary" onClick={() => void openCamera()}>
            <Camera /> Mode rafale
          </button>
          <button className="secondary" onClick={() => fileInput.current?.click()}>
            Importer
          </button>
          <button
            className="secondary"
            disabled={!scans.length || batchRunning}
            onClick={() => void runPending()}
          >
            {batchRunning ? <LoaderCircle className="spin" /> : <Search />}
            {batchRunning ? 'Analyse en cours…' : 'Analyser'}
          </button>
        </div>
        {cameraError && <small className="cameraError">{cameraError}</small>}
        <input
          ref={fileInput}
          hidden
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => void addFiles(event.target.files)}
        />
      </section>

      <section className="toolbar">
        <button
          onClick={() => setFilterEnabled((enabled) => !enabled)}
          className={filterEnabled ? 'chip active' : 'chip'}
        >
          <SlidersHorizontal /> ≥ {preferences.minimumValue} €
        </button>
        <span>
          {loadingHistory ? 'Chargement…' : `${visibleScans.length}/${scans.length} objets`}
        </span>
      </section>

      <section className="grid">
        {visibleScans.map((scan) => (
          <article className="card" key={scan.id}>
            <img src={scan.image} alt="Objet photographié" loading="lazy" />
            <div className="cardbody">
              <input
                value={scan.label}
                maxLength={160}
                placeholder="Nom de l’objet (optionnel)"
                onChange={(event) => patchScan(scan.id, { label: event.target.value })}
              />
              {scan.status === 'processing' && (
                <div className="state">
                  <LoaderCircle className="spin" /> Analyse…
                </div>
              )}
              {scan.estimate && (
                <div className="price">
                  <strong>{scan.estimate.floor.toFixed(0)} €</strong>
                  <span>
                    plancher · médiane {scan.estimate.median.toFixed(0)} € · {scan.estimate.count}{' '}
                    annonces
                  </span>
                </div>
              )}
              {scan.error && <small className="error">{scan.error}</small>}
              {scan.errorKind === 'item' && (
                <small className="hint">Cet objet sera ignoré par les prochains lots.</small>
              )}
              {scan.errorKind === 'configuration' && (
                <small className="hint">Corrige les réglages avant de relancer la file.</small>
              )}
              {scan.providerErrors && scan.providerErrors.length > 0 && (
                <div className="warning">
                  <AlertTriangle />
                  <span>{scan.providerErrors.map(providerErrorLabel).join(' · ')}</span>
                </div>
              )}
              <div className="row">
                <button onClick={() => void run(scan)} disabled={scan.status === 'processing'}>
                  <Search />
                  {scan.status === 'error'
                    ? 'Réessayer'
                    : scan.status === 'done'
                      ? 'Actualiser'
                      : 'Analyser'}
                </button>
                <button
                  className="danger"
                  onClick={() => removeScan(scan.id)}
                  aria-label="Supprimer l'objet"
                >
                  <Trash2 />
                </button>
              </div>
              {scan.listings.length > 0 && (
                <div className="providers">
                  {Array.from(new Set(scan.listings.map((listing) => listing.provider))).map(
                    (provider) => (
                      <span key={provider}>{providerNames[provider]}</span>
                    ),
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
        {!visibleScans.length && !loadingHistory && (
          <div className="empty">
            {scans.length
              ? 'Aucun objet ne dépasse le seuil.'
              : 'Prends plusieurs photos à la suite : elles resteront dans la file.'}
          </div>
        )}
      </section>

      {cameraOpen && (
        <div className="cameraView">
          <video ref={video} playsInline muted />
          <div className="cameraTop">
            <button className="icon dark" onClick={closeCamera} aria-label="Fermer la caméra">
              <X />
            </button>
            <span>{scans.length} objets</span>
          </div>
          <div className="cameraBottom">
            <button className="shutter" onClick={capture} aria-label="Prendre la photo">
              <span />
            </button>
            <button className="done" onClick={closeCamera}>
              Terminer
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="modal">
          <div className="sheet">
            <div className="sheethead">
              <h2>Réglages</h2>
              <button className="icon" onClick={() => setSettingsOpen(false)} aria-label="Fermer">
                <X />
              </button>
            </div>
            <label>
              Valeur minimale affichée <b>{preferences.minimumValue} €</b>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={preferences.minimumValue}
                onChange={(event) =>
                  setPreferences({ ...preferences, minimumValue: Number(event.target.value) })
                }
              />
            </label>
            <h3>Sources & priorité</h3>
            {preferences.providerOrder.map((id, index) => (
              <div className="provider" key={id}>
                <button
                  className={preferences.enabled[id] ? 'toggle on' : 'toggle'}
                  onClick={() =>
                    setPreferences({
                      ...preferences,
                      enabled: { ...preferences.enabled, [id]: !preferences.enabled[id] },
                    })
                  }
                  aria-label={`${preferences.enabled[id] ? 'Désactiver' : 'Activer'} ${providerNames[id]}`}
                >
                  {preferences.enabled[id] ? <Check /> : null}
                </button>
                <strong>{providerNames[id]}</strong>
                <span>#{index + 1}</span>
                <button className="mini" onClick={() => moveProvider(id, -1)} aria-label="Monter">
                  <ChevronUp />
                </button>
                <button className="mini" onClick={() => moveProvider(id, 1)} aria-label="Descendre">
                  <ChevronDown />
                </button>
              </div>
            ))}
            <label>
              Adresse API
              <input
                value={preferences.apiBase}
                maxLength={300}
                inputMode="url"
                onChange={(event) =>
                  setPreferences({ ...preferences, apiBase: event.target.value.trim() })
                }
              />
            </label>
            <label>
              Clé API <span className="hint">(optionnelle mais recommandée)</span>
              <input
                type="password"
                autoComplete="off"
                value={preferences.apiToken}
                maxLength={500}
                onChange={(event) =>
                  setPreferences({ ...preferences, apiToken: event.target.value })
                }
              />
            </label>
            <div className="settingsActions">
              <button className="secondary full" onClick={() => setPreferences(defaults)}>
                Réinitialiser les réglages
              </button>
              <button
                className="secondary full dangerText"
                disabled={batchRunning || hasProcessing}
                onClick={() => void clearHistory()}
              >
                Effacer l'historique
              </button>
            </div>
            <p className="hint">Réglages et historique restent sur ce téléphone.</p>
          </div>
        </div>
      )}
    </main>
  );
}
