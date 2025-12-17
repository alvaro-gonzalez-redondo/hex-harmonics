/**
 * Manejador de Web MIDI API con soporte para MPE / Microtonalidad.
 */
export class MidiController {
    constructor(grid, synth) {
        this.grid = grid;
        this.synth = synth;
        this.access = null;
        this.inputs = [];
        this.isReady = false;

        // Mapeo de notas activas para manejar NoteOff
        // Key: "Channel-Note" (ej: "1-60") -> Value: Hex Cell
        this.activeNotes = new Map();

        // Estado del Pitch Bend por canal (1-16)
        // Guardamos el valor crudo del Pitch Bend (0 - 16383). El centro es 8192.
        this.channelBends = new Array(17).fill(8192);

        // CONFIGURACIÓN MPE DEL FIRMWARE
        // Según tu código C++: byte MPEpitchBendSemis = 48;
        this.pitchBendRangeSemitones = 48;
    }

    async init() {
        if (!navigator.requestMIDIAccess) return false;
        try {
            this.access = await navigator.requestMIDIAccess();
            this.access.onstatechange = (e) => this.handleStateChange(e);
            this.updateInputs();
            this.isReady = true;
            return true;
        } catch (err) {
            console.error("MIDI Error", err);
            return false;
        }
    }

    updateInputs() {
        this.inputs = [];
        for (let input of this.access.inputs.values()) {
            this.inputs.push(input);
            input.onmidimessage = (msg) => this.handleMessage(msg);
        }
        this.updateStatusUI();
    }

    handleStateChange(e) { this.updateInputs(); }

    updateStatusUI() {
        const ui = document.getElementById('midiStatus');
        if (ui) {
            ui.innerText = this.inputs.length > 0
            ? `🎹 MIDI: ${this.inputs[0].name} (MPE Ready)`
            : "🎹 MIDI: No detectado";
            ui.style.color = this.inputs.length > 0 ? "#2ecc71" : "#888";
        }
    }

    handleMessage(msg) {
        const [status, data1, data2] = msg.data;
        const command = status & 0xf0;
        const channel = (status & 0x0f) + 1; // Canales 1-16

        // 1. Note On (144)
        if (command === 144 && data2 > 0) {
            this.noteOn(channel, data1, data2);
        }
        // 2. Note Off (128)
        else if (command === 128 || (command === 144 && data2 === 0)) {
            this.noteOff(channel, data1);
        }
        // 3. Pitch Bend (224 / 0xE0)
        else if (command === 224) {
            this.handlePitchBend(channel, data1, data2);
        }
    }

    handlePitchBend(channel, lsb, msb) {
        // Combinar los dos bytes de 7 bits en un valor de 14 bits (0 - 16383)
        const bendValue = (msb << 7) | lsb;
        this.channelBends[channel] = bendValue;
    }

    noteOn(channel, midiNote, velocity) {
        // 1. Calcular la afinación exacta usando el Pitch Bend almacenado para este canal
        const bendValue = this.channelBends[channel];

        // Normalizar bend de 0..16383 a -1..1
        // 8192 es el centro (0 bend)
        const normalizedBend = (bendValue - 8192) / 8192;

        // Calcular semitonos de desviación
        const bendSemitones = normalizedBend * this.pitchBendRangeSemitones;

        // Calcular nota MIDI flotante (ej: 60.5 es un cuarto de tono sobre Do)
        const preciseNote = midiNote + bendSemitones;

        // 2. Convertir a Frecuencia (Hz)
        // Fórmula estándar: f = 440 * 2^((d - 69)/12)
        const targetFreq = 440 * Math.pow(2, (preciseNote - 69) / 12);

        // 3. Buscar la celda más cercana en el Grid por frecuencia
        const matchingCell = this.grid.getClosestCellByFreq(targetFreq);

        if (matchingCell) {
            // Usamos una clave compuesta porque en MPE la misma nota puede sonar
            // en canales distintos con afinaciones distintas.
            const key = `${channel}-${midiNote}`;
            this.activeNotes.set(key, matchingCell);

            // Activar visualmente (invoca al setter .active del Grid que gestiona los Slots)
            // IMPORTANTE: MIDI siempre escribe en el Slot actual.
            if (!matchingCell.active) {
                matchingCell.active = true;
                this.grid.notify();
            }

            // Audio
            if (!this.synth.ctx) this.synth.init();
            if (this.synth.ctx.state === 'suspended') this.synth.ctx.resume();

            // Usamos la frecuencia REAL de la celda (afinada al sistema EDO),
            // no la frecuencia bruta del MIDI, para asegurar que suena "dentro" del sistema.
            this.synth.playTone(matchingCell.freq, this.synth.ctx.currentTime);
        }
    }

    noteOff(channel, midiNote) {
        const key = `${channel}-${midiNote}`;
        if (this.activeNotes.has(key)) {
            const cell = this.activeNotes.get(key);

            // Desactivar visualmente
            if (cell.active) {
                cell.active = false;
                this.grid.notify();
            }

            this.activeNotes.delete(key);

            // Opcional: Resetear el bend del canal al soltar la nota
            // this.channelBends[channel] = 8192;
        }
    }
}
