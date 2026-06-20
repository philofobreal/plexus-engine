import './style.css';

const bootStart = Date.now();
import { AudioEngine } from './audio/AudioEngine';
import { featureFlags } from './config/featureFlags';
import { DashboardUI } from './ui/DashboardUI';
import { startPlexusRenderer } from './visuals/PlexusRenderer';
import { createDefaultStyleRegistry } from './visuals/StyleRegistry';

const visualModeOptions = [
    { value: 'classic', label: 'Classic' },
    { value: 'temporal', label: 'Temporal' },
    { value: 'dark-techno', label: 'Dark Techno' },
    { value: 'organic-ambient', label: 'Organic Ambient' },
    { value: 'cyberpunk', label: 'Cyberpunk' },
    ...(featureFlags.heroEffect ? [{ value: 'hero', label: 'Hero' }] : [])
];

const generatorStrategyOptions = [
    { value: 'dramaturgy', label: 'Dramaturgy' },
    ...(featureFlags.heroEffect ? [{ value: 'hero', label: 'Hero Rhythm' }] : []),
    { value: 'strict', label: 'Strict Alternating' }
];

function renderOptions(options: Array<{ value: string; label: string }>): string {
    return options.map(option => `<option value="${option.value}">${option.label}</option>`).join('');
}

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="canvas-container" tabindex="0" aria-label="Visual playback surface">
    <video id="video-backplate" class="video-backplate" muted playsinline preload="metadata"></video>
  </div>
  
  <button id="center-play-btn" class="center-play-btn" disabled aria-label="Play">
    <svg viewBox="0 0 24 24" class="play-icon" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
  </button>

  <div id="media-loader-overlay" class="media-loader is-hidden">
    <div class="media-loader-box">
      <div id="media-loader-text" class="media-loader-text">Loading...</div>
      <div class="media-loader-track">
        <div id="media-loader-bar" class="media-loader-bar"></div>
      </div>
    </div>
  </div>

  <div class="ui-wrapper" id="ui-layer">
    <div class="top-row">
      <!-- Left metadata panel -->
      <div class="panel meta-panel">
        <div class="brand">
          <div class="brand-dot"></div>
          <h1>Plexus Engine</h1>
        </div>
        <div class="track-meta">
          <span id="status-text" class="track-title">Choose an audio file</span>
          <span id="bpm-header-badge" class="bpm-header-badge" style="display: none;">-- BPM</span>
        </div>
      </div>

      <!-- Right control panel -->
      <div class="controls panel">
        <label class="file-upload btn-pill" for="audio-upload">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          Load
        </label>
        <input type="file" id="audio-upload" class="file-input" accept="audio/*,video/*,video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska">
        
        <button id="play-btn" class="std-btn btn-pill" disabled>Play</button>
        
        <div class="select-wrapper">
          <select id="visual-mode" class="mode-select">
            ${renderOptions(visualModeOptions)}
          </select>
        </div>

        <div class="select-wrapper">
          <select id="visual-preset-list" class="mode-select preset-select" aria-label="Visual tuning presets">
            <option value="">No presets</option>
          </select>
        </div>

        <button id="toggle-loop" class="std-btn btn-pill is-active" aria-pressed="true">Loop</button>
        <button id="toggle-tuning-panel" class="std-btn btn-pill" aria-expanded="false">Tuning</button>
        <button id="fullscreen-btn" class="std-btn btn-icon btn-pill" title="Fullscreen">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
      </div>
    </div>

    <!-- Tuning Panel -->
    <div class="tuning-panel panel is-hidden" id="visual-tuning-panel">
      <div class="tuning-header" id="visual-tuning-drag-handle">
        <div class="tuning-title-area">
          <div class="panel-title">Visual Tuning</div>
          <p>Live effect parameters</p>
        </div>
        <div class="tuning-actions">
          <button id="copy-visual-config" class="std-btn btn-pill outline">Copy config</button>
        </div>
      </div>
      <div id="visual-tuning-controls" class="tuning-grid"></div>
      <div id="copy-config-status" class="copy-status" aria-live="polite"></div>
    </div>

    <!-- Bottom metrics and seekbar section -->
    <div class="bottom-section">
      <div class="metrics-grid is-hidden" id="metrics-grid">
        <div class="metric-card dyn-card" data-metric-key="dynamicsState" tabindex="0" aria-describedby="dashboard-metric-tooltip">
            <div class="m-label">Dynamics State</div>
            <div class="m-value dyn-text" id="val-dyn">IDLE</div>
            <div class="m-sub-label">Section Energy</div>
            <div class="m-bar-bg"><div class="m-bar-fill dyn-fill" id="bar-dyn"></div></div>
        </div>
        <div class="metric-card default-card" data-metric-key="energy" tabindex="0" aria-describedby="dashboard-metric-tooltip"><div class="m-label">Energy</div><div class="m-value" id="val-energy">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-energy"></div></div></div>
        <div class="metric-card default-card" data-metric-key="density" tabindex="0" aria-describedby="dashboard-metric-tooltip"><div class="m-label">Density</div><div class="m-value" id="val-bass">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-bass"></div></div></div>
        <div class="metric-card default-card" data-metric-key="melodyPresence" tabindex="0" aria-describedby="dashboard-metric-tooltip"><div class="m-label">Melody Presence</div><div class="m-value" id="val-mid">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-mid"></div></div></div>
        <div class="metric-card default-card" data-metric-key="vocal" tabindex="0" aria-describedby="dashboard-metric-tooltip"><div class="m-label">Vocal</div><div class="m-value" id="val-vocal">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-vocal"></div></div></div>
        <div class="metric-card default-card" data-metric-key="fx" tabindex="0" aria-describedby="dashboard-metric-tooltip"><div class="m-label">FX</div><div class="m-value" id="val-fx">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-fx"></div></div></div>
        <div class="metric-card default-card" data-metric-key="beatImpulse" tabindex="0" aria-describedby="dashboard-metric-tooltip"><div class="m-label">Beat Impulse</div><div class="m-value" id="val-beat">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-beat"></div></div></div>
        <div class="metric-card spectrum-card" data-metric-key="perceptualSpectrum" tabindex="0" aria-describedby="dashboard-metric-tooltip"><div class="m-label">Spectrum Balance</div><canvas id="perceptual-spectrum-canvas" class="mini-spectrum" data-column-count="24" aria-label="24 band perceptual spectrum"></canvas></div>
      </div>
      
      <div class="bottom-toolbar">
        <button id="toggle-metrics" class="metrics-toggle" aria-expanded="false">
          <span>Metrics</span>
          <svg class="metrics-toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>

      <div class="seek-container panel">
        <div class="timeline-header-row">
          <span class="timeline-title">Track Dramaturgy</span>
          <div class="timeline-actions">
            <!-- Layer visibility -->
            <div class="timeline-layer-toggles" style="display: flex; gap: 4px;">
              <button id="layer-toggle-waveform" class="layer-btn is-active" title="Toggle Waveform">W</button>
              <button id="layer-toggle-rms" class="layer-btn" title="Toggle RMS">R</button>
              <button id="layer-toggle-buildup" class="layer-btn" title="Toggle Buildup">B</button>
              <button id="layer-toggle-automation" class="layer-btn is-active" title="Toggle Automation">A</button>
            </div>
            <div class="timeline-divider"></div>
            <!-- Viewport behaviour -->
            <button id="toggle-timeline-snap" class="btn-icon-mini is-active" title="Toggle Snap (S)" aria-pressed="true" aria-label="Toggle grid snapping">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 10a7 7 0 0 1 14 0v4a2 2 0 0 0 2 2h1a2 2 0 0 0-2-2V10a9 9 0 0 0-18 0v4a2 2 0 0 0-2 2h1a2 2 0 0 0 2-2V10z"/></svg>
            </button>
            <button id="toggle-timeline-follow" class="btn-icon-mini is-active" title="Toggle Playhead Follow (F)" aria-pressed="true" aria-label="Toggle playhead follow">F</button>
            <div class="timeline-divider"></div>
            <!-- Draw mode -->
            <button id="toggle-timeline-draw" class="btn-icon-mini" title="Draw Envelope (D)" aria-pressed="false" aria-label="Draw envelope mode">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
            </button>
            <select id="timeline-draw-target" class="timeline-select" aria-label="Draw target">
              <option value="sensitivity">Sensitivity (S)</option>
              <option value="preset">Preset (P)</option>
            </select>
            <select id="timeline-preset-brush" class="timeline-select" aria-label="Preset brush">
              <option value="">No presets</option>
            </select>
            <button id="clear-automation-btn" class="btn-icon-mini" title="Clear All Automation" aria-label="Clear all automation"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
            <div class="timeline-divider"></div>
            <select id="generator-strategy" class="timeline-select" aria-label="Generation Strategy">
              ${renderOptions(generatorStrategyOptions)}
            </select>
            <button id="generate-plan-btn" class="timeline-export-btn" style="color: #fff; border-color: #fff;">Generate</button>
            <div class="timeline-divider"></div>
            <!-- Zoom / overlay -->
            <button id="toggle-timeline-zoom" class="btn-icon-mini" title="Zoom Timeline" aria-pressed="false" aria-label="Zoom timeline">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </button>
            <div class="timeline-divider"></div>
            <!-- Automation inspector -->
            <div id="automation-inspector" style="display: flex; gap: 8px; align-items: center; border: none; background: transparent; padding: 0; font-size: 0.75rem; opacity: 0.35; pointer-events: none;">
              <span style="color: var(--accent); font-weight: 700; white-space: nowrap;">Point:</span>
              <span id="inspector-time" style="font-family: monospace; min-width: 28px;">0:00</span>
              <select id="inspector-preset" class="timeline-select" aria-label="Select Preset"></select>
              <input type="number" id="inspector-duration" min="0.1" max="20" step="0.1" style="width: 44px; height: 24px; background: rgba(255,255,255,0.06); color: white; border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; text-align: center;" aria-label="Morph Duration">
              <select id="inspector-curve" class="timeline-select" aria-label="Morph Curve">
                <option value="linear">Linear</option>
                <option value="easeInOut">Ease In Out</option>
                <option value="exponential">Exponential</option>
              </select>
              <button id="inspector-add-btn" class="timeline-export-btn">+ Add</button>
              <button id="inspector-delete-btn" class="timeline-export-btn" style="background: rgba(255, 0, 100, 0.1); color: #ff3b3b; border-color: rgba(255,0,100,0.28);">Delete</button>
            </div>
            <div class="timeline-divider"></div>
            <!-- Export -->
            <select id="export-resolution" class="timeline-select" aria-label="Export resolution">
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4K">4K</option>
            </select>
            <select id="export-aspect" class="timeline-select" aria-label="Export aspect ratio">
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
            </select>
            <label class="timeline-checkbox" for="export-watermark">
              <input type="checkbox" id="export-watermark">
              <span>Watermark</span>
            </label>
            <button id="export-video-btn" class="timeline-export-btn" disabled>Export</button>
            <button id="stop-export-btn" class="timeline-export-btn is-hidden" disabled>Stop</button>
            <button id="cancel-export-btn" class="timeline-export-btn is-hidden" disabled>Cancel</button>
          </div>
        </div>
        <div id="strict-generator-settings" class="timeline-header-row is-hidden" style="padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.05); margin-bottom: 8px;">
          <span class="timeline-title" style="margin-right: 8px;">Strict Mode:</span>
          <select id="strict-p1" class="timeline-select preset-select"></select>
          <select id="strict-p2" class="timeline-select preset-select"></select>
          <select id="strict-p3" class="timeline-select preset-select"></select>
          <select id="strict-p4" class="timeline-select preset-select"></select>
          <span class="timeline-title" style="margin-left: 8px; margin-right: 4px;">Bars/Preset:</span>
          <input type="number" id="strict-bars" value="8" min="1" max="128" style="width: 40px; height: 24px; background: rgba(255,255,255,0.06); color: white; border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; text-align: center;">
          <span class="timeline-title" style="margin-left: 8px; margin-right: 4px;">Morph (s):</span>
          <input type="number" id="strict-morph" value="1.0" min="0.1" max="20" step="0.1" style="width: 40px; height: 24px; background: rgba(255,255,255,0.06); color: white; border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; text-align: center;">
        </div>
        <div class="timeline-wrapper">
          <div id="timeline-resize-handle" class="timeline-resize-handle" aria-hidden="true"></div>
          <canvas id="dramaturgy-timeline" class="dramaturgy-timeline" aria-label="Dramaturgy timeline"></canvas>
        </div>
        <div class="seek-row">
          <div class="time" id="time-current">0:00</div>
          <input type="range" class="main-seek" id="seek-bar" min="0" max="100" value="0" step="0.1" disabled>
          <div class="time" id="time-total">0:00</div>
        </div>
      </div>
    </div>
  </div>
`;

const engine = new AudioEngine();
const ui = new DashboardUI(engine);
const styleRegistry = createDefaultStyleRegistry();

const appReadyPromise = new Promise<void>(resolve => {
  startPlexusRenderer('canvas-container', ui, engine, styleRegistry);
  resolve();
});

const minDelayPromise = new Promise<void>(resolve => {
  const remaining = Math.max(0, 800 - (Date.now() - bootStart));
  setTimeout(resolve, remaining);
});

Promise.all([appReadyPromise, minDelayPromise]).then(() => {
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.classList.add('fade-out');
    loader.addEventListener('transitionend', () => loader.remove(), { once: true });
  }
});
