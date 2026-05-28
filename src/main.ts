import './style.css';
import { AudioEngine } from './audio/AudioEngine';
import { DashboardUI } from './ui/DashboardUI';
import { startPlexusRenderer } from './visuals/PlexusRenderer';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="canvas-container" tabindex="0" aria-label="Visual playback surface"></div>
  
  <button id="center-play-btn" class="center-play-btn" disabled aria-label="Play">
    <svg viewBox="0 0 24 24" class="play-icon" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
  </button>

  <div class="ui-wrapper" id="ui-layer">
    <div class="top-row">
      <!-- Bal oldali Meta Panel -->
      <div class="panel meta-panel">
        <div class="brand">
          <div class="brand-dot"></div>
          <h1>Plexus Engine</h1>
        </div>
        <div class="track-meta">
          <span id="status-text" class="track-title">Choose an audio file</span>
        </div>
      </div>

      <!-- Jobb oldali Vezérlő Panel -->
      <div class="controls panel">
        <label class="file-upload btn-pill" for="audio-upload">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          Load
        </label>
        <input type="file" id="audio-upload" class="file-input" accept="audio/*">
        
        <button id="play-btn" class="std-btn btn-pill" disabled>Play</button>
        
        <div class="select-wrapper">
          <select id="visual-mode" class="mode-select">
            <option value="classic">Classic</option>
            <option value="temporal">Temporal</option>
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

    <!-- Alsó szekció (Metrikák és Seekbar) -->
    <div class="bottom-section">
      <div class="metrics-grid" id="metrics-grid">
        <div class="metric-card bpm-card"><div class="m-label">BPM</div><div class="m-value bpm-badge" id="bpm-badge">--</div><div class="m-bar-bg"><div class="m-bar-fill" style="width:100%;"></div></div></div>
        <div class="metric-card"><div class="m-label">Energy</div><div class="m-value" id="val-energy">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-energy"></div></div></div>
        <div class="metric-card"><div class="m-label">Bass</div><div class="m-value" id="val-bass">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-bass"></div></div></div>
        <div class="metric-card"><div class="m-label">Mid</div><div class="m-value" id="val-mid">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-mid"></div></div></div>
        <div class="metric-card"><div class="m-label">Treble</div><div class="m-value" id="val-treble">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-treble"></div></div></div>
        <div class="metric-card"><div class="m-label">Melody</div><div class="m-value" id="val-melody">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-melody"></div></div></div>
        <div class="metric-card"><div class="m-label">Vocal</div><div class="m-value" id="val-vocal">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-vocal"></div></div></div>
        <div class="metric-card"><div class="m-label">FX</div><div class="m-value" id="val-fx">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-fx"></div></div></div>
        <div class="metric-card"><div class="m-label">Beat Hit</div><div class="m-value" id="val-beat">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-beat"></div></div></div>
        <div class="metric-card"><div class="m-label">Progress</div><div class="m-value" id="val-prog">0%</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-prog"></div></div></div>
        <div class="metric-card dyn-card">
            <div class="m-label">Music Block & Dynamics</div>
            <div class="m-value dyn-text" id="val-dyn">IDLE</div>
            <div class="m-bar-bg"><div class="m-bar-fill dyn-fill" id="bar-dyn"></div></div>
        </div>
      </div>
      
      <div class="bottom-toolbar">
        <button id="toggle-metrics" class="metrics-toggle" aria-expanded="true">
          <span>Metrics</span>
          <svg class="metrics-toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </button>
      </div>

      <div class="seek-container panel">
        <div class="timeline-header-row">
          <span class="timeline-title">Track Dramaturgy</span>
          <button id="toggle-timeline-zoom" class="btn-icon-mini" title="Zoom Timeline" aria-pressed="false" aria-label="Zoom timeline">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
          </button>
        </div>
        <div class="timeline-wrapper">
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

startPlexusRenderer('canvas-container', ui, engine);
