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
}
class BaseSetting {
    static frequencies = [392, 784, 1046.5, 1318.5, 1568, 1864.7, 2093, 2637];
    static audioContext = window.webkitAudioContext ? new webkitAudioContext() : new AudioContext();
}
class Decoder {
    static pad = '0b00000000';
    constructor(
        binVlueThresholdId = 'bin-value-threshold',
        outputId = 'output',
        clearId = 'clearBtn',
        codeId = 'code'
    ) {
        this.binVlueThresholdElm = document.getElementById(binVlueThresholdId);
        this.outputElm = document.getElementById(outputId);
        this.clearbtnElm = document.getElementById(clearId);
        this.codeElm = document.getElementById(codeId);
        this.clearbtnElm.addEventListener('click', (e) => {
            this.outputElm.value = '';
            e.target.blur();
        });
        // create audio nodes
        const analyser = BaseSetting.audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.0;
        analyser.minDecibels = -58;
        this.analyser = analyser;
        // buffer for analyser output
        this.buffer = new Uint8Array(analyser.frequencyBinCount);
        this.init();
    }
    async init() {
        // connect nodes
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const microphone = BaseSetting.audioContext.createMediaStreamSource(stream);
            microphone.connect(this.analyser);
            this.decode();
        } catch (err) {
            alert('Microphone is required.');
        }
        V.init();
    }
    // helper functions
    frequencyBinValue(f) {
        const hzPerBin =
            BaseSetting.audioContext.sampleRate / (2 * this.analyser.frequencyBinCount);
        const index = Math.floor((f + hzPerBin / 2) / hzPerBin);
        return this.buffer[index];
    }
    isActive(value) {
        const threshold = this.binVlueThresholdElm.value * 1;
        return value > threshold;
    }

    getState() {
        return BaseSetting.frequencies.map(this.frequencyBinValue).reduce((acc, val, idx) => {
            if (this.isActive(val)) {
                acc += 1 << idx;
            }
            return acc;
        }, 0);
    }

    output(state) {
        this.outputElm.value += String.fromCharCode(state % 256);
    }

    trace(state) {
        const str = state.toString(2);
        const text = Decoder.pad.substring(0, Decoder.pad.length - str.length) + str;
        this.codeElm.textContent = text;
    }

    async decode() {
        let prevState = 0;
        let duplicates = 0;
        while (true) {
            this.analyser.getByteFrequencyData(this.buffer);
            const state = this.getState();
            const duplicateThreshold = this.binVlueThresholdElm.value * 1;
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
        }
    }
}
