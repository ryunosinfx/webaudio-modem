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
    static b = document.body;
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
        return V.d.getElementById(id);
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
        const elemnt = typeof elm === 'string' ? V.gid(elm) : elm;
        elemnt.addEventListener(eventName, func);
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
    static getAudioContext() {
        return window.webkitAudioContext ? new webkitAudioContext() : new AudioContext();
        // return BaseSetting.audioContext;
    }
    static pad = '0b00000000';
}
V.init();
class Encoder {
    constructor(encodBtnId, clearBtnId, encodeInputId, pauseDurationId, activeDurationId) {
        const encodBtnElm = V.gid(encodBtnId);
        const clearBtnElm = V.gid(clearBtnId);
        const encodeInputElm = V.gid(encodeInputId);
        const pauseDurationElm = V.gid(pauseDurationId);
        const activeDurationElm = V.gid(activeDurationId);
        V.ael(encodBtnElm, 'click', async () => {
            V.sa(encodBtnElm, 'disabled', 'disabled');
            await this.encode(encodeInputElm.value, () => {
                encodBtnElm.removeAttribute('disabled');
            });
        });
        V.ael(clearBtnElm, 'click', () => {
            encodeInputElm.value = '';
            clearBtnElm.blur();
        });
        this.pauseDuration = pauseDurationElm.value * 1;
        V.ael(pauseDurationElm, 'change', (e) => {
            this.pauseDuration = e.target.value * 1;
        });
        this.activeDuration = activeDurationElm.value * 1;
        V.ael(activeDurationElm, 'change', (e) => {
            this.activeDuration = e.target.value * 1;
        });
        this.init();
    }
    async init() {
        this.audioContext = BaseSetting.getAudioContext();
        const masterGain = this.audioContext.createGain();
        masterGain.gain.value = 1.0 / BaseSetting.frequencies.length;
        const sinusoids = BaseSetting.frequencies.map((f) => {
            const oscillator = this.audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = f;
            oscillator.start();
            return oscillator;
        });
        const oscillators = BaseSetting.frequencies.map((f) => {
            const volume = this.audioContext.createGain();
            volume.gain.value = 0;
            return volume;
        });
        // connect nodes
        sinusoids.forEach((sine, i) => {
            sine.connect(oscillators[i]);
        });
        for (const osc of oscillators) {
            osc.connect(masterGain);
        }
        masterGain.connect(this.audioContext.destination);
        this.oscillators = oscillators;
    }
    char2oscillators(char) {
        return this.oscillators.filter((_, i) => {
            const charCode = char.charCodeAt(0);
            return charCode & (1 << i);
        });
    }
    mute() {
        for (const osc of this.oscillators) {
            osc.gain.value = 0;
        }
    }
    async encodeChar(char, duration) {
        const activeOscillators = this.char2oscillators(char);
        for (const osc of activeOscillators) {
            osc.gain.value = 1;
        }
        await ProsessUtil.sleep(duration);
        this.mute();
    }
    stop() {}
    start() {}
    async encode(text, onComplete) {
        const pause = this.pauseDuration;
        const duration = this.activeDuration;
        const timeBetweenChars = pause + duration;
        const chars = text.split('');
        const textLen = chars.length;
        for (let i = 0; i < textLen; i++) {
            await ProsessUtil.sleep(timeBetweenChars * i);
            await this.encodeChar(chars[i], duration);
        }
        await ProsessUtil.sleep(timeBetweenChars * textLen);
        onComplete();
    }
}
class Decoder {
    constructor(
        binVlueThresholdId = 'bin-value-threshold',
        duplicateStateThresholdId = 'duplicate-state-threshold"',
        outputId = 'output',
        clearId = 'clearBtn',
        codeId = 'code'
    ) {
        this.binVlueThresholdElm = V.gid(binVlueThresholdId);
        this.duplicateStateThresholdElm = V.gid(duplicateStateThresholdId);
        this.outputElm = V.gid(outputId);
        this.clearbtnElm = V.gid(clearId);
        this.codeElm = V.gid(codeId);
        V.ael(this.clearbtnElm, 'click', (e) => {
            this.outputElm.value = '';
            e.target.blur();
        });
        V.ael(this.binVlueThresholdElm, 'change', (e) => {
            this.setBinVlueThreshold(e.target.value);
        });
        this.binVlueThreshold = this.binVlueThresholdElm.value * 1;
        V.ael(this.duplicateStateThresholdElm, 'change', (e) => {
            this.setDuplicateVlueThreshold(e.target.value);
        });
        this.duplicateVlueThreshold = this.duplicateStateThresholdElm.value * 1;
        this.onOutput = (input) => {
            this.outputElm.value += input;
        };
        this.onTrace = (text) => {
            this.codeElm.textContent = text;
        };
        this.init();
    }
    async init() {
        // create audio nodes
        this.audioContext = BaseSetting.getAudioContext();
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.0;
        analyser.minDecibels = -58;
        this.analyser = analyser;
        // buffer for analyser output
        this.buffer = new Uint8Array(analyser.frequencyBinCount);
        // connect nodes
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const microphone = this.audioContext.createMediaStreamSource(stream);
            microphone.connect(this.analyser);
            this.decode();
        } catch (err) {
            alert('Microphone is required.');
        }
        this.isStop = false;
    }
    setBinVlueThreshold(threshold) {
        this.binVlueThreshold = threshold * 1;
    }
    setDuplicateVlueThreshold(threshold) {
        this.duplicateVlueThreshold = threshold * 1;
    }
    // helper functions
    frequencyBinValue() {
        return (f) => {
            const hzPerBin = this.audioContext.sampleRate / (2 * this.analyser.frequencyBinCount);
            const index = Math.floor((f + hzPerBin / 2) / hzPerBin);
            return this.buffer[index];
        };
    }
    isActive(value) {
        return value > this.binVlueThreshold;
    }

    getState() {
        return BaseSetting.frequencies.map(this.frequencyBinValue()).reduce((acc, val, idx) => {
            if (this.isActive(val)) {
                acc += 1 << idx;
            }
            return acc;
        }, 0);
    }
    output(state) {
        this.onOutput(String.fromCharCode(state % 256));
    }
    trace(state) {
        const str = state.toString(2);
        const text = BaseSetting.pad.substring(0, BaseSetting.pad.length - str.length) + str;
        this.onTrace(text);
    }
    stop() {
        this.isStop = true;
    }
    start() {
        this.decode();
    }
    async decode() {
        this.isStop = false;
        let prevState = 0;
        let duplicates = 0;
        while (true) {
            this.analyser.getByteFrequencyData(this.buffer);
            const state = this.getState();
            const duplicateThreshold = this.duplicateVlueThreshold;
            if (state === prevState) {
                duplicates++;
            } else {
                this.trace(state);
                prevState = state;
                duplicates = 0;
            }
            if (duplicates === duplicateThreshold) {
                this.output(state);
            }
            await ProsessUtil.sleep(1);
            if (this.isStop) {
                break;
            }
        }
    }
}
class EncodeVisualiser {
    constructor(
        waveformId,
        spectrumCanvasId,
        waveformCanvasId,
        pianoId,
        traceBinaryAreaId,
        traceTextAreaId
    ) {
        this.waveformElm = V.gid(waveformId);
        this.scElm = V.gid(spectrumCanvasId);
        this.wcElm = V.gid(waveformCanvasId);
        this.spectrumCtx = this.scElm.getContext('2d');
        this.waveformCtx = this.wcElm.getContext('2d');
        this.resizeTimeout = null;
        window.addEventListener('resize', (e) => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(this.adjustCanvasWidth(), 100);
        });
        // V.b.style.width = '100vw';
        this.init();
        this.HTMLPianKeyboard = new HTMLPianKeyboard(
            this,
            pianoId,
            traceBinaryAreaId,
            traceTextAreaId
        );
        setTimeout(this.adjustCanvasWidth(), 100);
    }
    init() {
        this.audioContext = BaseSetting.getAudioContext();
        const masterGain = this.audioContext.createGain();
        masterGain.gain.value = 1.0 / BaseSetting.frequencies.length;
        masterGain.connect(this.audioContext.destination);
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.0;
        analyser.minDecibels = -62;
        masterGain.connect(analyser);
        this.analyser = analyser;
        this.masterGain = masterGain;
        this.timeBuffer = new Uint8Array(analyser.frequencyBinCount);
        this.frequencyBuffer = new Uint8Array(analyser.frequencyBinCount);
        this.oscillators = {};
        this.animateCanvas();
        // this.stop();
    }
    playFrequency(frequency) {
        if (frequency in this.oscillators || this.isStop) {
            return;
        }
        const osc = this.audioContext.createOscillator();
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
            const parentWidth = window.getComputedStyle(this.scElm.parentNode.parentNode).width;
            const parentWidthW = window.getComputedStyle(this.wcElm.parentNode).width;
            V.sa(this.scElm, 'width', parentWidth);
            V.sa(this.wcElm, 'width', parentWidthW);
        };
    }
    frequencyBinIndex(f) {
        const hzPerBin = this.audioContext.sampleRate / (2 * this.analyser.frequencyBinCount);
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
        const bufferLength = buffer.byteLength;
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
                break;
            }
        }
        while (buffer[risingEdge++] - 128 < edgeThreshold && risingEdge <= width) {
            if (risingEdge >= width) {
                risingEdge = 0;
                break;
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
    start() {
        this.animateCanvas();
    }
    animateCanvas() {
        this.isStop = false;
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
    static ListenEventsEnd = ['mouseup', 'mouseleave', 'touchend', 'touchleave'];
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
    constructor(encodeVisualiser, pianoId, traceBinaryAreaId, traceTextAreaId) {
        this.encodeVisualiser = encodeVisualiser;
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
        this.init();
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
        elm.style.cursor = 'pointer';
        const keyPressed = (e) => {
            const elm = e.target;
            elm.classList.add('pressed');
            const frequency = V.ga(elm, 'data-frequency');
            this.encodeVisualiser.playFrequency(frequency);
        };
        const keyReleased = (e) => {
            const elm = e.target;
            elm.classList.remove('pressed');
            const frequency = V.ga(elm, 'data-frequency');
            this.encodeVisualiser.muteFrequency(frequency);
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
        const text = BaseSetting.pad.substring(0, BaseSetting.pad.length - str.length) + str;
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
class Spectrogramer {
    constructor(canvasId) {
        this.canvasElm = V.gid(canvasId);
        this.ctx = this.canvasElm.getContext('2d');
        this.WIDTH = this.canvasElm.width * 1;
        this.HEIGHT = this.canvasElm.height * 1;
        this.getOnResizeCanvasFunc()();
        this.resizeTimeout = null;
        window.addEventListener('resize', (e) => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(this.getOnResizeCanvasFunc(), 100);
        });
        this.audioContext = BaseSetting.getAudioContext();
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.0;
        // analyser.minDecibels = -58;
        this.analyser = analyser;
        this.buffer = new Uint8Array(analyser.frequencyBinCount);
        this.init();
    }
    async init() {
        // connect nodes
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const microphone = this.audioContext.createMediaStreamSource(stream);
            microphone.connect(this.analyser);
            this.decode();
        } catch (err) {
            alert('Microphone is required.');
        }
    }
    getOnResizeCanvasFunc() {
        return () => {
            const parentNode = this.canvasElm.parentNode;
            V.sa(this.canvasElm, 'width', parentNode.offsetWidth);
            V.sa(this.canvasElm, 'height', parentNode.offsetHeight);
            this.WIDTH = this.canvasElm.width * 1;
            this.HEIGHT = this.canvasElm.height * 1;
        };
    }
    shiftUp() {
        const imageData = this.ctx.getImageData(0, 1, this.WIDTH, this.HEIGHT);
        this.ctx.clearRect(0, 0, this.WIDTH, this.HEIGHT);
        this.ctx.putImageData(imageData, 0, 0);
    }
    stop() {
        this.isStop = false;
    }
    start() {
        this.animate();
    }
    animate() {
        this.isStop = false;
        this.requestID = null;
        const draw = () => {
            if (this.isStop) {
                window.cancelAnimationFrame(this.requestID);
                return;
            }
            this.shiftUp();
            this.analyser.getByteFrequencyData(this.buffer);
            const dx = Math.floor(Math.ceil(this.WIDTH / this.buffer.byteLength));
            this.buffer.forEach((x, i) => {
                const alpha = x / 256.0;
                this.ctx.fillStyle = `rgba(100, 255, 100, ${alpha})`;
                this.ctx.fillRect(i * dx, HEIGHT - 1, dx, 1);
            });
            this.requestID = requestAnimationFrame(draw);
        };
        draw();
    }
}

class WebAudioModem {
    constructor(tabIds) {
        this.map = {};
        this.map[tabIds[0]] = () => {
            return this.encoder;
        };
        this.map[tabIds[1]] = () => {
            return this.decoder;
        };
        this.map[tabIds[2]] = () => {
            return this.encodeVisualiser;
        };
        this.map[tabIds[3]] = () => {
            return this.spectrogramer;
        };
    }
    buildPianKeybord(pianoId, traceBinaryAreaId, traceTextAreaId) {
        this.HTMLPianKeyboard = new HTMLPianKeyboard(pianoId, traceBinaryAreaId, traceTextAreaId);
    }
    buildEncodeVisualiser(
        waveformId,
        spectrumCanvasId,
        waveformCanvasId,
        pianoId,
        traceBinaryAreaId,
        traceTextAreaId
    ) {
        this.encodeVisualiser = new EncodeVisualiser(
            waveformId,
            spectrumCanvasId,
            waveformCanvasId,
            pianoId,
            traceBinaryAreaId,
            traceTextAreaId
        );
    }
    buildDecoder(binVlueThresholdId, duplicateStateThresholdId, outputId, clearId, codeId) {
        this.decoder = new Decoder(
            binVlueThresholdId,
            duplicateStateThresholdId,
            outputId,
            clearId,
            codeId
        );
    }
    buildEncoder(encodBtnId, clearBtnId, encodeInputId, pauseDurationId, activeDurationId) {
        this.encoder = new Encoder(
            encodBtnId,
            clearBtnId,
            encodeInputId,
            pauseDurationId,
            activeDurationId
        );
    }
    buildSpectrogramer(canvasId) {
        this.spectrogramer = new Spectrogramer(canvasId);
    }
    switchView(tabId) {
        for (const [key, value] of Object.entries(this.map)) {
            if (key === tabId) {
                value().start();
            } else {
                value().stop();
            }
        }
    }
}
class WebAudioModemView {
    constructor(tabIds, wam) {
        for (let tabId of tabIds) {
            V.ael(tabId, 'click', this.showTab(tabId, tabIds));
        }
        this.wam = wam;
    }
    showTab(selectTabId, tabIds) {
        const suffix = '-body';
        const tabIdsWithSuffix = [];
        for (let tabId of tabIds) {
            tabIdsWithSuffix.push(tabId + suffix);
        }
        return () => {
            this.showTabExec(selectTabId, tabIds);
            this.showTabExec(selectTabId + suffix, tabIdsWithSuffix);
            this.wam.switchView(selectTabId);
        };
    }
    showTabExec(selectTabId, tabIds, prefixis = ['']) {
        for (let prefix of prefixis) {
            const cn = prefix + 'selected';
            for (let tabId of tabIds) {
                if (tabId === selectTabId) {
                    continue;
                }
                const elm = V.gid(tabId);
                if (elm.classList.contains(cn)) {
                    elm.classList.remove(cn);
                }
            }
            const elmSelected = V.gid(selectTabId);
            elmSelected.classList.add(cn);
        }
    }
}
const tabIds = ['encoder', 'decoder', 'encoder-visual', 'spectrogram'];
const wam = new WebAudioModem(tabIds);
new WebAudioModemView(tabIds, wam);
const binVlueThresholdId = 'bin-value-threshold';
const duplicateStateThresholdId = 'duplicate-state-threshold';
const outputId = 'decoder-output';
const clearId = 'decode-clear';
const codeId = 'decode-code';
wam.buildDecoder(binVlueThresholdId, duplicateStateThresholdId, outputId, clearId, codeId);
const encodBtnId = 'encode-action';
const encodeInputId = 'encode-input';
const clearBtnId = 'encode-clear';
const pauseDurationId = 'pause-duration';
const activeDurationId = 'active-duration';
wam.buildEncoder(encodBtnId, clearBtnId, encodeInputId, pauseDurationId, activeDurationId);

const pianoId = 'piano';
const traceBinaryAreaId = 'trace-binary';
const traceTextAreaId = 'trace-text';
const waveformId = 'waveform';
const waveformCanvasId = 'waveform-canvas';
const spectrumCanvasId = 'spectrum-canvas';
wam.buildEncodeVisualiser(
    waveformId,
    spectrumCanvasId,
    waveformCanvasId,
    pianoId,
    traceBinaryAreaId,
    traceTextAreaId
);
const canvasId = 'spectrogram-canvas';
wam.buildSpectrogramer(canvasId);
