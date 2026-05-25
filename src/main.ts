import './style.css';
import { AudioEngine } from './audio/AudioEngine';
import { DashboardUI } from './ui/DashboardUI';
import { startPlexusRenderer } from './visuals/PlexusRenderer';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="canvas-container" tabindex="0" aria-label="Visual playback surface"></div>
  <button id="center-play-btn" class="center-play-btn" disabled aria-label="Play">
    <span class="play-triangle"></span>
  </button>
  <div class="ui-wrapper" id="ui-layer">
    <div class="top-row">
      <div class="panel">
        <h1>Plexus Engine</h1>
        <div class="track-meta">
          <span id="status-text" class="track-title">Choose an audio file</span>
        </div>
      </div>
      <div class="controls panel">
        <label class="file-upload" for="audio-upload">Load Audio</label>
        <input type="file" id="audio-upload" class="file-input" accept="audio/*">
        <button id="play-btn" class="std-btn" disabled>Play</button>
        <label class="mode-select-label" title="Visual effect mode">
          <select id="visual-mode" class="mode-select">
            <option value="classic">Classic</option>
            <option value="temporal">Temporal</option>
          </select>
        </label>
        <select id="visual-preset-list" class="mode-select preset-select" aria-label="Visual tuning presets">
          <option value="">No presets</option>
        </select>
        <button id="toggle-loop" class="std-btn compact-btn is-active" aria-pressed="true">Loop</button>
        <button id="toggle-tuning-panel" class="std-btn compact-btn" aria-expanded="false">Tuning</button>
        <button id="fullscreen-btn" class="std-btn btn-icon" title="Fullscreen">[]</button>
      </div>
    </div>
    <div class="tuning-panel panel is-hidden" id="visual-tuning-panel">
      <div class="tuning-header" id="visual-tuning-drag-handle">
        <div>
          <div class="panel-title">Visual tuning</div>
          <p>Live effect parameters</p>
        </div>
        <div class="tuning-actions">
          <button id="copy-visual-config" class="std-btn compact-btn">Copy config</button>
        </div>
      </div>
      <div id="visual-tuning-controls" class="tuning-grid"></div>
      <div id="copy-config-status" class="copy-status" aria-live="polite"></div>
    </div>
    <div class="bottom-section">
      <div class="metrics-grid" id="metrics-grid">
        <div class="metric-card bpm-card"><div class="m-label">BPM</div><div class="m-value bpm-badge" id="bpm-badge">-- BPM</div><div class="m-bar-bg"><div class="m-bar-fill" style="background:#00ffcc; width:100%;"></div></div></div>
        <div class="metric-card"><div class="m-label">Energy</div><div class="m-value" id="val-energy">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-energy" style="background:#a78bfa;"></div></div></div>
        <div class="metric-card"><div class="m-label">Bass</div><div class="m-value" id="val-bass">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-bass" style="background:#60a5fa;"></div></div></div>
        <div class="metric-card"><div class="m-label">Mid</div><div class="m-value" id="val-mid">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-mid" style="background:#34d399;"></div></div></div>
        <div class="metric-card"><div class="m-label">Treble</div><div class="m-value" id="val-treble">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-treble" style="background:#f472b6;"></div></div></div>
        <div class="metric-card"><div class="m-label">Melody</div><div class="m-value" id="val-melody">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-melody" style="background:#38bdf8;"></div></div></div>
        <div class="metric-card"><div class="m-label">Vocal</div><div class="m-value" id="val-vocal">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-vocal" style="background:#fb7185;"></div></div></div>
        <div class="metric-card"><div class="m-label">FX</div><div class="m-value" id="val-fx">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-fx" style="background:#bef264;"></div></div></div>
        <div class="metric-card"><div class="m-label">Beat Hit</div><div class="m-value" id="val-beat">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-beat" style="background:#f43f5e;"></div></div></div>
        <div class="metric-card"><div class="m-label">Progress</div><div class="m-value" id="val-prog">0%</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-prog" style="background:#22d3ee;"></div></div></div>
        <div class="metric-card" style="border-color: rgba(0,255,204,0.3); display:flex; flex-direction:column; justify-content:center;">
            <div class="m-label">Music Block & Dynamics</div>
            <div class="m-value" id="val-dyn" style="color:#00ffcc; font-size:1.1rem; padding-top:4px;">IDLE</div>
            <div class="m-bar-bg"><div class="m-bar-fill" id="bar-dyn" style="background:#00ffcc;"></div></div>
        </div>
      </div>
      <div class="bottom-toolbar">
        <button id="toggle-metrics" class="metrics-toggle" aria-expanded="true">
          <span class="metrics-toggle-icon">v</span>
          <span>Metrics</span>
        </button>
      </div>
      <div class="seek-container">
        <div class="time" id="time-current">0:00</div>
        <input type="range" class="main-seek" id="seek-bar" min="0" max="100" value="0" step="0.1" disabled>
        <div class="time" id="time-total">0:00</div>
      </div>
    </div>
  </div>
`;

const engine = new AudioEngine();
const ui = new DashboardUI(engine);

startPlexusRenderer('canvas-container', ui, engine);
