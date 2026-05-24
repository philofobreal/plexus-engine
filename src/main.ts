import './style.css';
import { AudioEngine } from './audio/AudioEngine';
import { DashboardUI } from './ui/DashboardUI';
import { startPlexusRenderer } from './visuals/PlexusRenderer';

// 1. UI Felépítése
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div id="canvas-container"></div>
  <div class="ui-wrapper" id="ui-layer">
    <div class="top-row">
      <div class="panel">
        <h1>Plexus Engine <span id="bpm-badge" class="bpm-badge">-- BPM</span></h1>
        <p id="status-text">Válassz zenét a kezdéshez</p>
      </div>
      <div class="controls panel">
        <label class="file-upload">Load Audio<input type="file" id="audio-upload" accept="audio/*"></label>
        <button id="play-btn" class="std-btn" disabled>Play</button>
        <button id="fullscreen-btn" class="std-btn btn-icon" title="Teljes Képernyő">⛶</button>
      </div>
    </div>
    <div class="bottom-section">
      <div class="metrics-grid">
        <div class="metric-card"><div class="m-label">Energy</div><div class="m-value" id="val-energy">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-energy" style="background:#a78bfa;"></div></div></div>
        <div class="metric-card"><div class="m-label">Bass</div><div class="m-value" id="val-bass">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-bass" style="background:#60a5fa;"></div></div></div>
        <div class="metric-card"><div class="m-label">Mid</div><div class="m-value" id="val-mid">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-mid" style="background:#34d399;"></div></div></div>
        <div class="metric-card"><div class="m-label">Treble</div><div class="m-value" id="val-treble">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-treble" style="background:#f472b6;"></div></div></div>
        <div class="metric-card"><div class="m-label">Beat Hit</div><div class="m-value" id="val-beat">0.00</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-beat" style="background:#f43f5e;"></div></div></div>
        <div class="metric-card"><div class="m-label">Progress</div><div class="m-value" id="val-prog">0%</div><div class="m-bar-bg"><div class="m-bar-fill" id="bar-prog" style="background:#22d3ee;"></div></div></div>
        <div class="metric-card" style="border-color: rgba(0,255,204,0.3); grid-column: span 2; display:flex; flex-direction:column; justify-content:center;">
            <div class="m-label">Zenei Blokk & Dinamika</div>
            <div class="m-value" id="val-dyn" style="color:#00ffcc; font-size:1.1rem; padding-top:4px;">IDLE</div>
            <div class="m-bar-bg"><div class="m-bar-fill" id="bar-dyn" style="background:#00ffcc;"></div></div>
        </div>
      </div>
      <div class="seek-container">
        <div class="time" id="time-current">0:00</div>
        <input type="range" class="main-seek" id="seek-bar" min="0" max="100" value="0" step="0.1" disabled>
        <div class="time" id="time-total">0:00</div>
      </div>
    </div>
  </div>
`;

// 2. Osztályok inicializálása
const engine = new AudioEngine();
const ui = new DashboardUI(engine);

// 3. Renderelő motor indítása (p5.js)
startPlexusRenderer('canvas-container', ui, engine);