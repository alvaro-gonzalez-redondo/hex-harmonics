import { TuningSystem, Hex, Layout, Grid } from './models.js';
import { Renderer, LinearVisualizer } from './views.js';
import { Synth } from './audio.js';
import { MidiController } from './midi.js';


// --- CONFIGURACIÓN INICIAL ---
const HEX_SIZE = 30;
const MAP_RADIUS = 10;

// Inicialización de Modelos
const tuning = new TuningSystem(12);
const grid = new Grid(tuning);
const layout = new Layout(HEX_SIZE, { x: window.innerWidth/2, y: window.innerHeight/2 });

// Generar Mapa Inicial
grid.generateMap(MAP_RADIUS);

// Definimos qué pasa al hacer click
const handleHexClick = (cellData) => {
    // 1. Cambiar estado visual (Modelo)
    const wasActive = cellData.active;
    grid.toggleHex(cellData.hex);

    // 2. Disparar sonido si se acaba de activar (Audio)
    if (!wasActive) {
        // Si el contexto no existe, lo creamos ahora mismo.
        if (!synth.ctx) {
            synth.init();
        }
        // Si el navegador lo suspendió (política de autoplay), lo reanudamos.
        if (synth.ctx.state === 'suspended') {
            synth.ctx.resume();
        }
        // Ahora es seguro acceder a 'currentTime' porque 'ctx' ya existe
        synth.playTone(cellData.freq, synth.ctx.currentTime);
    }

    // 3. Refrescar vista
    renderer.refresh();
};

// Inicialización de Vistas
const renderer = new Renderer('hexCanvas', layout, grid, handleHexClick);
const linearViz = new LinearVisualizer('linearCanvas', grid);

// Inicialización de Audio
const synth = new Synth();

// Inicialización MIDI
const midi = new MidiController(grid, synth);
midi.init(); // Pide permisos al navegador

// --- BINDINGS (Observadores y Eventos) ---

// 1. Cuando el Grid cambia, las vistas se actualizan
grid.subscribe(() => {
    renderer.refresh();
    // linearViz se suscribe internamente en su constructor,
    // pero si lo hiciéramos manual sería aquí.
});

// 2. Controles de UI
const ui = {
    edoSelect: document.getElementById('edoSelect'),
    sensSlider: document.getElementById('sensSlider'),
    compSlider: document.getElementById('complexitySlider'),
    btnChord: document.getElementById('btnChord'),
    btnArp: document.getElementById('btnArp')
};

// Reset UI state
ui.edoSelect.value = "12";
ui.sensSlider.value = "80";
ui.compSlider.value = "10";

// --- EVENT LISTENERS ---

// Cambio de Sistema (EDO)
ui.edoSelect.addEventListener('change', (e) => {
    synth.stop(); // Detener audio por seguridad
    const newEdo = e.target.value;

    tuning.setEdo(newEdo);

    // El renderer necesita recalcular su LUT porque cambiaron las matemáticas
    renderer.lut.recalculate(newEdo, renderer.complexityWeight);

    grid.refreshData(); // Actualizar frecuencias y notas en el grid
    renderer.refresh();
    linearViz.draw();
});

// Sliders Visuales
ui.sensSlider.addEventListener('input', (e) => renderer.setSensitivity(e.target.value));
ui.compSlider.addEventListener('input', (e) => renderer.setComplexityWeight(e.target.value));

// Botones Audio
ui.btnChord.addEventListener('click', () => {
    const notes = grid.getActiveCells();
    if (notes.length) synth.playChord(notes);
});

ui.btnArp.addEventListener('click', () => {
    synth.stop(); // Reset
    const notes = grid.getActiveCells();
    if (notes.length) synth.startArpeggioLoop(() => grid.getActiveCells());
});

// Teclado
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.repeat) return;

    if (e.code === 'Space') {
        e.preventDefault();
        const notes = grid.getActiveCells();
        if (!notes.length) return;

        if (e.shiftKey) {
            synth.startArpeggioLoop(() => grid.getActiveCells());
        } else {
            synth.playChord(notes);
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') synth.stop();
});

// Seguridad: Parar audio si la pestaña pierde foco
window.addEventListener('blur', () => synth.stop());
