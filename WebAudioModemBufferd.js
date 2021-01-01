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
        if (!elm) {
            return;
        }
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
    static frequenciesb = [392, 784, 1046.5, 1318.5, 1568, 1864.7, 2093, 2637];
    static frequencies = [697, 770, 852, 941, 1209, 1336, 1477, 1633];
    static audioContext = window.webkitAudioContext ? new webkitAudioContext() : new AudioContext();
    static getAudioContext() {
        return window.webkitAudioContext ? new webkitAudioContext() : new AudioContext();
        // return BaseSetting.audioContext;
    }
    static pad = '0b00000000';
}
V.init();
class Oscillator {
    constructor(frequencies = BaseSetting.frequencies) {
        this.frequencies = frequencies;
        this.inited = false;
    }
    async init() {
        if (this.inited) {
            return;
        }
        this.audioContext = BaseSetting.getAudioContext();
        const masterGain = this.audioContext.createGain();
        masterGain.gain.value = 1.0 / this.frequencies.length;
        const sinusoids = [];
        const oscillators = [];
        for (const frequency of this.frequencies) {
            const sine = this.audioContext.createOscillator();
            sine.type = 'square'; //square sine
            sine.frequency.value = frequency;
            sine.start();
            sinusoids.push(sine);
            const volume = this.audioContext.createGain();
            volume.gain.value = 0;
            oscillators.push(volume);
            sine.connect(volume);
            volume.connect(masterGain);
        }
        // connect nodes
        masterGain.connect(this.audioContext.destination);
        this.oscillators = oscillators;
        this.inited = true;
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
    async encode(text, onComplete) {
        const pause = this.pauseDuration;
        const duration = this.activeDuration;
        const timeBetweenChars = pause + duration;
        const chars = text.split('');
        const textLen = chars.length;
        for (let i = 0; i < textLen; i++) {
            await ProsessUtil.sleep(timeBetweenChars * 1);
            await this.encodeChar(chars[i], duration);
        }
        await ProsessUtil.sleep(timeBetweenChars * textLen);
        onComplete();
    }
}
class Encoder {
    constructor(encodBtnId, clearBtnId, encodeInputId, pauseDurationId, activeDurationId) {
        this.Oscillator = new Oscillator();
        const encodBtnElm = V.gid(encodBtnId);
        const clearBtnElm = V.gid(clearBtnId);
        const encodeInputElm = V.gid(encodeInputId);
        const pauseDurationElm = V.gid(pauseDurationId);
        const activeDurationElm = V.gid(activeDurationId);
        V.ael(encodBtnElm, 'click', async () => {
            V.sa(encodBtnElm, 'disabled', 'disabled');
            await this.Oscillator.encode(encodeInputElm.value, () => {
                encodBtnElm.removeAttribute('disabled');
            });
        });
        V.ael(clearBtnElm, 'click', () => {
            encodeInputElm.value = '';
            clearBtnElm.blur();
        });
        this.Oscillator.pauseDuration = pauseDurationElm.value * 1;
        V.ael(pauseDurationElm, 'change', (e) => {
            this.Oscillator.pauseDuration = e.target.value * 1;
        });
        this.Oscillator.activeDuration = activeDurationElm.value * 1;
        V.ael(activeDurationElm, 'change', (e) => {
            this.Oscillator.activeDuration = e.target.value * 1;
        });
    }
    stop() {}
    start() {
        this.Oscillator.init();
    }
}
class Reciver {
    constructor(
        frequencies = BaseSetting.frequencies,
        fftSize = 4096,
        smoothingTimeConstant = 0.0,
        minDecibels = -68
    ) {
        this.frequencies = frequencies;
        // create audio nodes
        this.audioContext = BaseSetting.getAudioContext();
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = smoothingTimeConstant;
        analyser.minDecibels = minDecibels;
        this.analyser = analyser;
        // buffer for analyser output
        this.buffer = new Uint8Array(analyser.frequencyBinCount);
        this.history = [];
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
        this.isStop = false;
    }
    setBinVlueThreshold(threshold) {
        this.binVlueThreshold = threshold * 1;
    }
    setDuplicateVlueThreshold(threshold) {
        this.duplicateVlueThreshold = threshold * 1;
    }
    getState() {
        let acc = 0;
        let idx = 0;
        const hzPerBin = this.audioContext.sampleRate / (2 * this.analyser.frequencyBinCount);
        const list = [];
        let max = 0;
        let sum = 0;
        let count = 0;
        for (const f of this.frequencies) {
            const index = Math.floor((f + hzPerBin / 2) / hzPerBin);
            const value = this.buffer[index];
            const valueM = this.buffer[index - 2];
            const valueP = this.buffer[index + 2];
            const valueM3 = this.buffer[index - 3];
            const valueP3 = this.buffer[index + 3];
            if (value > valueM && value > valueP && valueP > valueP3 && valueM > valueM3) {
                // if (value > this.binVlueThreshold) {
                //     acc = acc * 1 + (1 << idx) * 1;
                // }
                max = max > value ? max : value;
                sum += value;
                list.push(value);
                count++;
            } else {
                list.push(0);
            }
        }
        let isIncreas = true;
        let isCheck = false;
        if (this.history.length > 0) {
            const old = this.history.shift();
            if (old) {
                for (let i = 0, len = old.length; i < len; i++) {
                    if (old[i] > list[i]) {
                        isIncreas = false;
                        break;
                    }
                }
            }
            isCheck = true;
        }
        this.history.push(list);
        if (max > this.binVlueThreshold && isIncreas && isCheck) {
            const avg = sum / count;
            const diff = max - avg;
            for (const val of list) {
                if (max - val < avg) {
                    acc += (1 << idx) * 1;
                }
                idx++;
            }
        }
        console.log(
            'acc:' +
                acc +
                '/max:' +
                max +
                '/' +
                this.binVlueThreshold +
                '/' +
                this.audioContext.sampleRate +
                '/' +
                this.analyser.frequencyBinCount
        );
        // this.lastMax =
        return acc;
    }
    output(states) {
        const chars = [];
        while (true) {
            const state = states.shift();
            if (!state) {
                break;
            }
            chars.push(String.fromCharCode(state % 256));
        }
        this.onOutput(chars.join(''));
    }
    trace(state) {
        const str = state.toString(2);
        const text = BaseSetting.pad.substring(0, BaseSetting.pad.length - str.length) + str;
        this.onTrace(text + ' ' + state + ' ' + String.fromCharCode(state % 256));
    }
    stop() {
        this.isStop = true;
    }
    start() {
        this.decode();
    }
    getTargetData(buf, mainIndexes, now, binVlueThreshold) {
        const list = [];
        let max = 0;
        let min = 255;
        for (const index of mainIndexes) {
            const target = buf[index];
            max = target > max ? target : max;
            min = target > min ? min : target;
            list.push(target);
            list.push(buf[index - 2]);
            list.push(buf[index + 2]);
            list.push(buf[index - 3]);
            list.push(buf[index + 3]);
        }
        list.push(now);
        list.push(
            max >= binVlueThreshold && min >= binVlueThreshold / 2
                ? 255
                : max < binVlueThreshold && min < binVlueThreshold / 2
                ? 0
                : 128
        );
        return list;
    }
    calcTargetIndexes() {
        const main = [];
        const hzPerBin = this.audioContext.sampleRate / (2 * this.analyser.frequencyBinCount);
        for (const f of this.frequencies) {
            const index = Math.floor((f + hzPerBin / 2) / hzPerBin);
            main.push(index);
        }
        return main;
    }
    async decode() {
        this.isStop = false;
        let prevState = 0;
        let duplicates = 0;
        const duplicateThreshold = this.duplicateVlueThreshold;
        const states = [];
        const times = [];
        const thesholdMs = 15;
        const thesholdMsEnd = thesholdMs * 2;
        const now = Date.now();
        const state = {
            now: now,
            lastOn: 0,
            lastEnd: 0,
            isRecording: false,
        };
        const mainIndexes = this.calcTargetIndexes();
        const dataList = [];
        while (true) {
            const start = Date.now();
            this.analyser.getByteFrequencyData(this.buffer);
            const selected = this.getTargetData(
                this.buffer,
                mainIndexes,
                start,
                this.binVlueThreshold
            );
            const stateIndex = selected.length - 1;
            const selectedSate = selected[stateIndex];
            if (state.isRecording) {
                state.lastEnd = selectedSate ? start : state.lastEnd;
                if (start - state.lastEnd > thesholdMsEnd) {
                    state.isRecording = false;
                } else {
                    dataList.push(selected);
                }
            } else {
                state.lastEnd = selectedSate === 255 ? start : state.lastEnd;
            }

            const state = this.getState();
            if (state) {
                if (state === prevState) {
                    duplicates++;
                } else {
                    setTimeout(() => {
                        this.trace(state);
                    });
                    prevState = state;
                    duplicates = 0;
                }
                if (duplicates === duplicateThreshold) {
                    states.push(state);
                    this.history.splice(0, this.history.length);
                    duplicates = 0;
                }
            } else {
                prevState = state;
                duplicates = 0;
                setTimeout(() => {
                    while (true) {
                        const diff = times.shift();
                        if (!diff) {
                            break;
                        }
                        console.log('diff:' + diff);
                    }
                    this.output(states);
                });
            }
            times.push(Date.now() - start);
            await ProsessUtil.sleep(0);
            if (this.isStop) {
                break;
            }
        }
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
        this.reciver = new Reciver();
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
            this.reciver.setBinVlueThreshold(e.target.value);
        });
        this.reciver.binVlueThreshold = this.binVlueThresholdElm.value * 1;
        V.ael(this.duplicateStateThresholdElm, 'change', (e) => {
            this.reciver.setDuplicateVlueThreshold(e.target.value);
        });
        this.reciver.duplicateVlueThreshold = this.duplicateStateThresholdElm.value * 1;
        this.reciver.onOutput = (input) => {
            // console.log(this.outputElm.value + input);
            this.outputElm.value += input;
        };
        this.reciver.onTrace = (text) => {
            this.codeElm.textContent = text;
        };
        this.reciver.stop();
    }
    stop() {
        this.reciver.stop();
    }
    start() {
        this.reciver.start();
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
const tabIds = ['encoder', 'decoder'];
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
