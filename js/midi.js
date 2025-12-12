/**
 * Manejador de Web MIDI API.
 * Conecta un teclado físico con el Grid virtual.
 */
export class MidiController {
    constructor(grid, synth) {
        this.grid = grid;
        this.synth = synth;
        this.access = null;
        this.inputs = [];
        this.isReady = false;

        // Mapeo de notas activas para manejar NoteOff correctamente
        // Key: MIDI Note Number -> Value: Hex Cell
        this.activeNotes = new Map();
    }

    async init() {
        if (!navigator.requestMIDIAccess) {
            console.warn("Web MIDI API no soportada en este navegador.");
            return false;
        }

        try {
            this.access = await navigator.requestMIDIAccess();

            // Escuchar cambios de conexión (si enchufas el USB después de cargar)
            this.access.onstatechange = (e) => this.handleStateChange(e);

            this.updateInputs();
            this.isReady = true;
            console.log("🎹 MIDI Ready");
            return true;
        } catch (err) {
            console.error("Fallo al acceder al MIDI", err);
            return false;
        }
    }

    updateInputs() {
        this.inputs = [];
        for (let input of this.access.inputs.values()) {
            this.inputs.push(input);
            // Reiniciamos el listener para evitar duplicados
            input.onmidimessage = (msg) => this.handleMessage(msg);
            console.log(`Dispositivo conectado: ${input.name}`);
        }

        this.updateStatusUI();
    }

    handleStateChange(e) {
        console.log(`MIDI State Change: ${e.port.name} -> ${e.port.state}`);
        this.updateInputs();
    }

    updateStatusUI() {
        const ui = document.getElementById('midiStatus');
        if (ui) {
            if (this.inputs.length > 0) {
                ui.innerText = `🎹 MIDI: ${this.inputs[0].name}`;
                ui.style.color = "#27ae60";
            } else {
                ui.innerText = "🎹 MIDI: No detectado";
                ui.style.color = "#888";
            }
        }
    }

    handleMessage(msg) {
        const [status, data1, data2] = msg.data;
        const command = status & 0xf0; // Enmascarar canal

        // Note On (144) con velocidad > 0
        if (command === 144 && data2 > 0) {
            this.noteOn(data1, data2);
        }
        // Note Off (128) o Note On con velocidad 0
        else if (command === 128 || (command === 144 && data2 === 0)) {
            this.noteOff(data1);
        }
    }

    noteOn(midiNote, velocity) {
        // 1. Calcular paso relativo al Do Central (60)
        const centerNote = 60;
        const targetStep = midiNote - centerNote;

        // 2. Buscar celda (usando el método optimizado si lo implementaste, o el normal)
        // const matchingCell = this.grid.getCellBySteps(targetStep); // Si usaste la optimización
        const cells = this.grid.getAll();
        const matchingCell = cells.find(c => c.pitchSteps === targetStep);

        if (matchingCell) {
            this.activeNotes.set(midiNote, matchingCell);

            // Visual: Activar
            if (!matchingCell.active) {
                matchingCell.active = true;
                this.grid.notify();
            }

            // 1. Asegurar que el contexto de audio existe
            if (!this.synth.ctx) {
                this.synth.init();
            }

            // 2. Intentar reanudar si está suspendido (Políticas de Autoplay del navegador)
            if (this.synth.ctx.state === 'suspended') {
                this.synth.ctx.resume();
            }

            // 3. Ahora sí es seguro acceder a currentTime
            this.synth.playTone(matchingCell.freq, this.synth.ctx.currentTime);
        }
    }

    noteOff(midiNote) {
        if (this.activeNotes.has(midiNote)) {
            const cell = this.activeNotes.get(midiNote);

            // Visual: Desactivar
            if (cell.active) {
                cell.active = false;
                this.grid.notify(); // Redibujar
            }

            this.activeNotes.delete(midiNote);
        }
    }
}
