/**
 * Motor de Audio simple usando Web Audio API.
 * Simula un arpa etérea.
 */
export class Synth {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.arpTimeout = null;
        this.isArpActive = false;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;

            // Compresor para nivelar el volumen
            const comp = this.ctx.createDynamicsCompressor();
            comp.threshold.value = -20;
            this.masterGain.connect(comp);
            comp.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, startTime) {
        if (!this.ctx) this.init();

        const oscBody = this.ctx.createOscillator();
        const oscString = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        const panner = this.ctx.createStereoPanner();

        // Configuración de timbre
        oscBody.type = 'sine';
        oscBody.frequency.value = freq;
        oscString.type = 'triangle';
        oscString.frequency.value = freq;

        // Filtro "Pluck"
        filter.type = 'lowpass';
        filter.Q.value = 0;
        filter.frequency.setValueAtTime(Math.min(freq * 4, 3000), startTime);
        filter.frequency.exponentialRampToValueAtTime(freq, startTime + 2.0);

        // Panning (Stereo Spread)
        const panVal = Math.max(-0.9, Math.min(0.9, (Math.log2(freq) - Math.log2(65)) / (Math.log2(1000) - Math.log2(65)) * 2 - 1));
        panner.pan.value = panVal;

        // Envolvente (ADSR simulado)
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.5, startTime + 0.04); // Ataque
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 4.0); // Release largo

        // Routing
        oscBody.connect(gain);
        oscString.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);

        oscBody.start(startTime);
        oscString.start(startTime);

        const stopTime = startTime + 4.5;
        oscBody.stop(stopTime);
        oscString.stop(stopTime);

        setTimeout(() => { gain.disconnect(); panner.disconnect(); }, 5000);
    }

    playChord(cells) {
        this.init();
        const now = this.ctx.currentTime;
        cells.forEach((cell, i) => {
            this.playTone(cell.freq, now + i * 0.03); // Strumming
        });
    }

    // --- Arpegiador Loop ---
    startArpeggioLoop(getNotesCallback) {
        if (this.isArpActive) return;
        this.isArpActive = true;
        this.init();

        const loop = () => {
            if (!this.isArpActive) return;
            const notes = getNotesCallback();

            if (notes && notes.length > 0) {
                // Tocar arpegio ascendente
                const now = this.ctx.currentTime;
                const sorted = [...notes].sort((a, b) => a.freq - b.freq);
                sorted.forEach((cell, idx) => {
                    this.playTone(cell.freq, now + idx * 0.25);
                });

                const duration = notes.length * 250;
                this.arpTimeout = setTimeout(loop, duration);
            } else {
                this.stop();
            }
        };
        loop();
    }

    stop() {
        if (this.arpTimeout) clearTimeout(this.arpTimeout);
        this.isArpActive = false;
        this.arpTimeout = null;
    }
}
