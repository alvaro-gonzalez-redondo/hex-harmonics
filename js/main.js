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

    if (isArpOn) btnArp.click(); // Forzar apagado visual y lógico
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

// GESTIÓN DE PANELES (UI)
const setupPanel = (headerId, contentId) => {
    const header = document.getElementById(headerId);
    const content = document.getElementById(contentId);

    if (!header || !content) {
        console.error(`Panel setup failed: ${headerId} or ${contentId} not found.`);
        return;
    }

    // El contenedor es el padre del contenido (ej: #ui o #legend)
    const container = content.parentElement;

    header.addEventListener('click', (e) => {
        e.stopPropagation(); // Evita que el click pase al canvas
        container.classList.toggle('collapsed');
    });
};

// Asegúrate de que esto se llame DESPUÉS de que el DOM esté listo
setupPanel('uiHeader', 'uiContent');
setupPanel('legendHeader', 'legendContent');

// --- CONTROLES Y EVENTOS ---

// 1. Botón MIDI
const btnMidi = document.getElementById('btnMidi');
const midiStatus = document.getElementById('midiStatus');

btnMidi.addEventListener('click', async () => {
    if (midi.isReady) return; // Ya está activo

    btnMidi.innerText = "Solicitando permiso...";
    const success = await midi.init();

    if (success) {
        btnMidi.classList.add('btn-midi-active');
        btnMidi.innerText = "MIDI Activado";
        midiStatus.style.display = 'block';
    } else {
        btnMidi.innerText = "Error / No Soportado";
        setTimeout(() => btnMidi.innerText = "🎹 Activar MIDI", 2000);
    }
});

// 2. Botón Arpegio (Toggle)
const btnArp = document.getElementById('btnArp');
let isArpOn = false;

btnArp.addEventListener('click', () => {
    if (isArpOn) {
        // APAGAR
        synth.stop();
        isArpOn = false;
        btnArp.classList.remove('active');
        btnArp.innerText = "Arpegio (Shift+Esp)";
    } else {
        // ENCENDER
        const notes = grid.getActiveCells();
        if (notes.length > 0) {
            synth.stop(); // Reset por seguridad
            synth.startArpeggioLoop(() => grid.getActiveCells());
            isArpOn = true;
            btnArp.classList.add('active');
            btnArp.innerText = "⏹ Detener Arpegio";
        }
    }
});
