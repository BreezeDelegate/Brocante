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
import type { Listing, Preferences, ProviderId, Scan } from './types';

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

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function providerSummary(listings: Listing[], provider: ProviderId) {
  const prices = listings.filter((listing) => listing.provider === provider).map((listing) => listing.price);
  if (!prices.length) return undefined;
  return {
    count: prices.length,
    minimum: Math.min(...prices),
    median: median(prices),
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
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [stageById, setStageById] = useState<Record<string, string>>({});
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
  const batchCandidates = scans.filter(shouldProcessInBatch).length;

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

  function setStage(id: string, stage?: string): void {
    setStageById((current) => {
      if (stage) return { ...current, [id]: stage };
      const next = { ...current };
      delete next[id];
      return next;
    });
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
        error: 'Active au moins une source dans les réglages.',
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
      if (!label) {
        setStage(scan.id, 'Identification automatique de la photo…');
        label = await identify(preferences, scan.image);
      }
      if (!label) {
        patchScan(scan.id, {
          status: 'error',
          errorKind: 'configuration',
          error:
            'Identification visuelle indisponible sur ce serveur. Active Ollama pour analyser les photos sans saisie manuelle.',
        });
        return false;
      }

      patchScan(scan.id, { label });
      setStage(scan.id, `Recherche sur ${providers.map((provider) => providerNames[provider]).join(', ')}…`);
      const result = await search(preferences, label, providers);
      if (allProvidersFailed(result.errors, providers) && result.listings.length === 0) {
        patchScan(scan.id, {
          status: 'error',
          errorKind: 'transient',
          providerErrors: result.errors,
          error: 'Aucune source n’a pu répondre. La file est mise en pause pour éviter de marteler les sites.',
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
      setStage(scan.id);
      inFlight.current.delete(scan.id);
    }
  }

  async function runPending(): Promise<void> {
    if (batchRunning) return;
    const pending = scans.filter(shouldProcessInBatch);
    if (!pending.length) return;

    setBatchRunning(true);
    setBatchProgress({ done: 0, total: pending.length });
    try {
      for (const scan of pending) {
        if (inFlight.current.has(scan.id)) continue;
        const shouldContinue = await run(scan);
        setBatchProgress((current) => ({ ...current, done: current.done + 1 }));
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
        <p>Photographie d’abord. Brocante identifie, compare et trie ensuite.</p>
        <div className="actions">
          <button className="primary" onClick={() => void openCamera()}>
            <Camera /> Mode rafale
          </button>
          <button className="secondary" onClick={() => fileInput.current?.click()}>
            Importer
          </button>
          <button
            className="secondary bulkButton"
            disabled={!batchCandidates || batchRunning}
            onClick={() => void runPending()}
          >
            {batchRunning ? <LoaderCircle className="spin" /> : <Search />}
            {batchRunning
              ? `Analyse ${batchProgress.done}/${batchProgress.total}`
              : `Analyser tout${batchCandidates ? ` (${batchCandidates})` : ''}`}
          </button>
        </div>
        {batchRunning && batchProgress.total > 0 && (
          <div className="batchProgress" aria-live="polite">
            <span style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }} />
          </div>
        )}
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
        <span>{loadingHistory ? 'Chargement…' : `${visibleScans.length}/${scans.length} objets`}</span>
      </section>

      <section className="scanList">
        {visibleScans.map((scan) => (
          <article className={`scanCard status-${scan.status}`} key={scan.id}>
            <div className="scanPhotoWrap">
              <img src={scan.image} alt="Objet photographié" loading="lazy" />
              <span className="scanStatus">
                {scan.status === 'processing'
                  ? 'Analyse'
                  : scan.status === 'done'
                    ? 'Terminé'
                    : scan.status === 'error'
                      ? 'À vérifier'
                      : 'En attente'}
              </span>
            </div>

            <div className="scanContent">
              <div className="scanTopline">
                <div>
                  <strong className="scanTitle">{scan.label || 'Objet à identifier'}</strong>
                  <span className="scanSubtitle">
                    {scan.label ? 'Nom détecté automatiquement · modifiable si besoin' : 'La photo sera identifiée automatiquement'}
                  </span>
                </div>
                <button
                  className="deleteButton"
                  onClick={() => removeScan(scan.id)}
                  aria-label="Supprimer l'objet"
                  disabled={scan.status === 'processing'}
                >
                  <Trash2 />
                </button>
              </div>

              <details className="nameCorrection">
                <summary>Corriger le nom de recherche</summary>
                <input
                  value={scan.label}
                  maxLength={160}
                  placeholder="Ex. Game Boy Color violette"
                  onChange={(event) => patchScan(scan.id, { label: event.target.value })}
                />
              </details>

              {scan.status === 'processing' && (
                <div className="state" aria-live="polite">
                  <LoaderCircle className="spin" /> {stageById[scan.id] ?? 'Analyse en cours…'}
                </div>
              )}

              {scan.estimate && (
                <div className="estimateSummary">
                  <div>
                    <span>Prix prudent</span>
                    <strong>{scan.estimate.floor.toFixed(0)} €</strong>
                  </div>
                  <div>
                    <span>Médiane</span>
                    <strong>{scan.estimate.median.toFixed(0)} €</strong>
                  </div>
                  <div>
                    <span>Annonces</span>
                    <strong>{scan.estimate.count}</strong>
                  </div>
                </div>
              )}

              {scan.status === 'done' && scan.listings.length === 0 && (
                <div className="emptyResult">Analyse terminée : aucune annonce comparable trouvée.</div>
              )}

              {scan.listings.length > 0 && (
                <div className="marketRows">
                  {preferences.providerOrder.map((provider) => {
                    const summary = providerSummary(scan.listings, provider);
                    const error = scan.providerErrors?.find((item) => item.provider === provider);
                    if (!summary && !error) return null;
                    return (
                      <div className="marketRow" key={provider}>
                        <strong>{providerNames[provider]}</strong>
                        {summary ? (
                          <>
                            <span>min {summary.minimum.toFixed(0)} €</span>
                            <span>méd. {summary.median.toFixed(0)} €</span>
                            <span>{summary.count} annonce{summary.count > 1 ? 's' : ''}</span>
                          </>
                        ) : (
                          <span className="marketError">{error ? providerErrorLabel(error) : 'indisponible'}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {scan.error && (
                <div className="errorPanel">
                  <AlertTriangle />
                  <span>{scan.error}</span>
                </div>
              )}
              {scan.providerErrors && scan.providerErrors.length > 0 && scan.listings.length === 0 && (
                <div className="warning">
                  <AlertTriangle />
                  <span>{scan.providerErrors.map(providerErrorLabel).join(' · ')}</span>
                </div>
              )}

              <div className="scanActions">
                <button onClick={() => void run(scan)} disabled={scan.status === 'processing'}>
                  {scan.status === 'processing' ? <LoaderCircle className="spin" /> : <Search />}
                  {scan.status === 'error'
                    ? 'Réessayer'
                    : scan.status === 'done'
                      ? 'Actualiser'
                      : 'Analyser cet objet'}
                </button>
              </div>
            </div>
          </article>
        ))}

        {!visibleScans.length && !loadingHistory && (
          <div className="empty">
            {scans.length
              ? 'Aucun objet ne dépasse le seuil actuel.'
              : 'Prends plusieurs photos à la suite : elles resteront dans la file avant analyse.'}
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
