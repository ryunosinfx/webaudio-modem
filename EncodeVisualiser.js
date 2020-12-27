class ProsessUtil {
    static sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, ms);
        });
    }
}
class V {
    static d = document;
    static c(tagName) {
        return V.d.createElement(tagName);
    }
    static a(elm, child) {
        return elm.appendChild(child);
    }
    static q(selector) {
        return V.d.querySelector(selector);
    }
    static gid(id) {
        return V.getElementById(id);
    }
    static ga(elm, attrName) {
        return elm.getAttribute(attrName);
    }
    static sa(elm, attrName, value) {
        return elm.setAttribute(attrName, value);
    }
    static qa(selector) {
        return V.d.querySelectorAll(selector);
    }
    static ael(elm, eventName, func) {
        elm.addEventListener(eventName, func);
    }
    static init() {
        // config behaviour
        for (let input of V.qa('input')) {
            const label = V.q(`label[for="${V.ga(input, 'id')}"] [data-val]`);
            label.textContent = input.value;
            V.ael(input, 'change', (e) => {
                label.textContent = e.target.value;
            });
        }
    }
    static fireEvent(elm, eventType) {
        // Thanks to https://stackoverflow.com/a/2706236
        if (elm.fireEvent) {
            elm.fireEvent('on' + eventType);
        } else {
            const evObj = V.d.createEvent('Events');
            evObj.initEvent(eventType, true, false);
            elm.dispatchEvent(evObj);
        }
    }
}
class BaseSetting {
    static frequencies = [392, 784, 1046.5, 1318.5, 1568, 1864.7, 2093, 2637];
    static audioContext = window.webkitAudioContext ? new webkitAudioContext() : new AudioContext();
}
class EncodeVisualiser {
    constructor(waveformId, spectrumCanvasId, waveformCanvasId) {
        this.waveformElm = V.gid(waveformId);
        this.scElm = V.gid(spectrumCanvasId);
        this.wcElm = V.gid(waveformCanvasId);
        this.spectrumCtx = this.scElm.getContext('2d');
        this.waveformCtx = this.wcElm.getContext('2d');
        this.adjustCanvasWidth()();
        this.resizeTimeout = null;
        window.addEventListener('resize', (e) => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(this.adjustCanvasWidth(), 100);
        });
        this.init();
        V.init();
    }
    async int() {
        const masterGain = BaseSetting.audioContext.createGain();
        masterGain.gain.value = 1.0 / BaseSetting.frequencies.length;
        masterGain.connect(BaseSetting.audioContext.destination);
        const analyser = BaseSetting.audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.0;
        analyser.minDecibels = -62;
        masterGain.connect(analyser);
        this.analyser = analyser;
        this.masterGain = masterGain;
        this.timeBuffer = new Uint8Array(analyser.frequencyBinCount);
        this.frequencyBuffer = new Uint8Array(analyser.frequencyBinCount);
        this.oscillators = {};
    }

    playFrequency(frequency) {
        if (frequency in this.oscillators) {
            return;
        }
        const osc = BaseSetting.audioContext.createOscillator();
        osc.connect(this.masterGain);
        osc.type = this.waveformElm.value;
        osc.frequency.value = frequency;
        osc.start();
        this.oscillators[frequency] = osc;
    }

    muteFrequency(frequency) {
        const osc = this.oscillators[frequency];
        if (osc) {
            osc.stop();
            this.oscillators[frequency] = null;
            delete this.oscillators[frequency];
        }
    }
    adjustCanvasWidth() {
        return () => {
            V.sa(this.scElm, 'width', this.scElm.parentNode.offsetWidth);
            V.sa(this.wcElm, 'width', this.wcElm.parentNode.offsetWidth);
        };
    }
    frequencyBinIndex(f) {
        const hzPerBin =
            BaseSetting.audioContext.sampleRate / (2 * this.analyser.frequencyBinCount);
        return Math.floor((f + hzPerBin / 2) / hzPerBin);
    }

    drawSpectrum() {
        const rgb02550 = 'rgb(0, 255, 0)';
        const rgb1503 = 'rgb(150, 150, 150)';
        const ctx = this.spectrumCtx;
        const buffer = this.frequencyBuffer;
        const canvas = this.scElm;
        const bufferLength = buffer.byteLength / 5;
        const flen = BaseSetting.frequencies.length;

        const height = canvas.height;
        const width = canvas.width;

        const dx = Math.max(1, (1.0 * width) / bufferLength);
        this.analyser.getByteFrequencyData(buffer);

        // clear canvas
        ctx.fillStyle = 'rgba(0, 20, 0, 0.1)';
        ctx.lineWidth = 1;
        ctx.fillRect(0, 0, width, height);
        // draw trigger markers
        for (let i = 0; i < flen; i++) {
            const f = BaseSetting.frequencies[i];
            const binIndex = this.frequencyBinIndex(f);
            ctx.fillStyle = buffer[binIndex] > 124 ? rgb02550 : rgb1503;
            ctx.font = '18px monospace';
            ctx.fillText(2, dx * binIndex - 6, 20);
            ctx.font = '12px monospace';
            ctx.fillText(i, dx * binIndex + 4, 11);
        }

        // draw latest response bar chart
        ctx.fillStyle = 'rgb(0, 200, 0)';
        for (let i = 0; i < bufferLength; i++) {
            const scale = (0.8 * height) / 256;
            const y = buffer[i] * scale;
            ctx.fillRect(i * dx, height - y, Math.max(dx - 1, 1), y);
        }
        ctx.stroke();
    }
    drawWaveform() {
        const ctx = this.waveformCtx;
        const buffer = this.timeBuffer;
        const canvas = this.wcElm;
        let bufferLength = buffer.byteLength;

        // Based on https://codepen.io/ContemporaryInsanity/pen/Mwvqpb
        const width = canvas.width;
        const height = canvas.height;
        const scaling = height / 256;
        let risingEdge = 0;
        let edgeThreshold = 5;

        this.analyser.getByteTimeDomainData(buffer);

        // clear canvas
        ctx.fillStyle = 'rgba(0, 10, 0, 0.1)';
        ctx.fillRect(0, 0, width, height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgb(0, 200, 0)';
        ctx.beginPath();

        // No buffer overrun protection
        while (buffer[risingEdge++] - 128 > 0 && risingEdge <= width) {
            if (risingEdge >= width) {
                risingEdge = 0;
            }
        }

        while (buffer[risingEdge++] - 128 < edgeThreshold && risingEdge <= width) {
            if (risingEdge >= width) {
                risingEdge = 0;
            }
        }

        for (let x = risingEdge; x < bufferLength && x - risingEdge < width; x++) {
            ctx.lineTo(x - risingEdge, height - buffer[x] * scaling);
        }
        ctx.stroke();
    }
    stop() {
        this.isStop = true;
    }
    animateCanvas() {
        this.isStop = true;
        this.requestID = null;
        const draw = () => {
            if (this.isStop) {
                window.cancelAnimationFrame(this.requestID);
                return;
            }
            this.drawSpectrum();
            this.drawWaveform();
            this.requestID = requestAnimationFrame(draw);
        };
        draw();
    }
}
class HTMLPianKeyboard {
    static ListenEventsStart = ['mousedown', 'mouseover', 'touchstart', 'touchenter'];
    static ListenEventsEnd = ['mousedown', 'mouseover', 'touchstart', 'touchenter'];
    static notes = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
    static frequencies = [
        27.5,
        29.14,
        30.87,
        32.7,
        34.65,
        36.71,
        38.89,
        41.2,
        43.65,
        46.25,
        49,
        51.91,
        55,
        58.27,
        61.74,
        65.41,
        69.3,
        73.42,
        77.78,
        82.41,
        87.31,
        92.5,
        98,
        103.83,
        110,
        116.54,
        123.47,
        130.81,
        138.59,
        146.83,
        155.56,
        164.81,
        174.61,
        185,
        196,
        207.65,
        220,
        233.08,
        246.94,
        261.63,
        277.18,
        293.66,
        311.13,
        329.63,
        349.23,
        369.99,
        392,
        415.3,
        440,
        466.16,
        493.88,
        523.25,
        554.37,
        587.33,
        622.25,
        659.26,
        698.46,
        739.99,
        784,
        830.61,
        880,
        932.33,
        987.77,
        1046.5,
        1108.73,
        1174.66,
        1244.51,
        1318.5,
        1396.91,
        1479.98,
        1568,
        1661.22,
        1760,
        1864.7,
        1975.53,
        2093,
        2217.46,
        2349.32,
        2489.02,
        2637,
        2793.83,
        2959.96,
        3135.96,
        3322.44,
        3520,
        3729.31,
        3951.07,
        4186.01,
    ];
    constructor(pianoId, traceBinaryAreaId, traceTextAreaId) {
        this.pianoId = pianoId;
        this.pianoElm = V.gid(pianoId);
        this.traceBinaryAreaElm = V.gid(traceBinaryAreaId);
        this.traceTextAreaElm = V.gid(traceTextAreaId);
        window.addEventListener('keydown', (e) => {
            const value = e.key.length === 1 ? e.key.charCodeAt(0) : e.keyCode;
            const frequencies = this.byte2frequencies(value);
            for (const frequency of frequencies) {
                this.press(frequency);
            }
            this.trace(value, e.key);
        });
        window.addEventListener('keyup', (e) => {
            for (const frequency of HTMLPianKeyboard.frequencies) {
                this.release(frequency);
            }
        });
    }

    getKeyElm(frequency, note, octave) {
        const elm = V.c('div');
        V.sa(elm, 'data-note', note);
        V.sa(elm, 'data-octave', octave);
        V.sa(elm, 'data-frequency', frequency);
        if (note === 'C') {
            const span = V.c('span');
            span.textContent = note;
            const sub = V.c('sub');
            sub.textContent = octave;
            V.a(span, sub);
            V.a(elm, span);
        }
        const keyPressed = (e) => {
            e.target.classList.add('pressed');
            this.playFrequency(frequency);
        };
        const keyReleased = (e) => {
            e.target.classList.remove('pressed');
            this.muteFrequency(frequency);
        };
        for (const event of HTMLPianKeyboard.ListenEventsStart) {
            V.ael(elm, event, keyPressed);
        }
        for (const event of HTMLPianKeyboard.ListenEventsEnd) {
            V.ael(elm, event, keyReleased);
        }
        return elm;
    }
    init() {
        let octave = 0;
        const len = HTMLPianKeyboard.frequencies.length;
        const nlen = HTMLPianKeyboard.notes.length;
        for (let i = 0; i < len; i++) {
            const note = HTMLPianKeyboard.notes[i % nlen];
            if (note === 'C') {
                octave++;
            }
            const pianoKeyElm = this.getKeyElm(HTMLPianKeyboard.frequencies[i], note, octave);
            V.a(this.pianoElm, pianoKeyElm);
        }
    }
    trace(state, label) {
        const str = state.toString(2);
        const pad = '0b00000000';
        const text = pad.substring(0, pad.length - str.length) + str;
        this.traceBinaryAreaElm.textContent = text;
        this.traceTextAreaElm.textContent = label;
    }

    byte2frequencies(byte) {
        return HTMLPianKeyboard.frequencies.filter((_, i) => {
            return byte & (1 << i);
        });
    }
    press(frequency) {
        const keyElm = V.q(`#${this.pianoId} [data-frequency="${frequency}"]`);
        V.fireEvent(keyElm, 'mousedown');
    }
    release(frequency) {
        const keyElm = V.q(`#${this.pianoId} [data-frequency="${frequency}"]`);
        V.fireEvent(keyElm, 'mouseup');
    }
}
