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
        this.frequenciesLen = frequencies.length;
        this.inited = false;
        window.addEventListener('click', (e) => {
            this.init();
        });
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
    charcode2oscillators(charCode) {
        return this.oscillators.filter((_, i) => {
            return charCode & (1 << i);
        });
    }
    mute() {
        for (const osc of this.oscillators) {
            osc.gain.value = 0;
        }
    }
    async encodeCharcode(charCode, duration) {
        // const activeOscillators = this.charcode2oscillators(charCode);
        for (let i = 0; i < this.frequenciesLen; i++) {
            const osc = this.oscillators[i];
            osc.gain.value = charCode & (1 << i) ? 1 : 0;
        }
        await ProsessUtil.sleep(duration);
    }
    async encode(text, onComplete) {
        const pause = this.pauseDuration;
        const duration = this.activeDuration;
        const timeBetweenChars = (pause + duration) * 1;
        const chars = text.split('');
        const textLen = chars.length;
        await this.encodeCharcode(255, duration * 2);
        for (let i = 0; i < textLen; i++) {
            if (pause) {
                await ProsessUtil.sleep(pause * 1);
            }
            const char = chars[i];
            const charCode = char.charCodeAt(0);
            await this.encodeCharcode(charCode, duration);
        }
        this.mute();
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
        this.isStop = true;
    }
    setBinVlueThreshold(threshold) {
        this.binVlueThreshold = threshold * 1;
    }
    setSpanDulation(spanDuration) {
        this.spanDuration = spanDuration * 1;
    }
    output(chars) {
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
    calcTargetIndexes() {
        const targetIndexes = [];
        const hzPerBin = this.audioContext.sampleRate / (2 * this.analyser.frequencyBinCount);
        for (const f of this.frequencies) {
            const index = Math.floor((f + hzPerBin / 2) / hzPerBin);
            targetIndexes.push(index);
        }
        return targetIndexes;
    }
    parse(bufferedData, indexCount, targetIndexCount) {
        console.log(
            'parse bufferedData.length:' +
                bufferedData.length +
                '/indexCount:' +
                indexCount +
                '/targetIndexCount:' +
                targetIndexCount
        );
        const CHARS = /[-_0-9a-zA-Z]/;
        const spanUnitMs = 10;
        const cap = 1000000;
        const delimiter = ':';
        const peakList = [];
        const maxes = new Uint8Array(targetIndexCount);
        maxes.fill(0);
        const mins = new Uint8Array(targetIndexCount);
        mins.fill(255);
        const dBuffers = new Array(targetIndexCount);
        dBuffers.fill(0);
        const lastBuffers = new Array(targetIndexCount);
        lastBuffers.fill(0);
        const lastDBuffers = new Array(targetIndexCount);
        lastDBuffers.fill(0);
        const firstRow = bufferedData[0];
        const firstTime = firstRow[firstRow.length - 2];
        let lastState = 0;
        for (const row of bufferedData) {
            const state = row.pop();
            const time = row.pop();
            const data = [];
            for (let i = 0; i < indexCount; i++) {
                const index = i; //Math.floor(i / 5);
                const target = row[i];
                const max = maxes[index];
                const lastValue = lastBuffers[index];
                const dValue = target - lastValue;
                const lastDValue = lastDBuffers[index];
                const pValue = dValue * (lastDValue === 0 ? 1 : lastDValue);
                lastDBuffers[index] = dBuffers[index];
                dBuffers[index] = dValue;
                lastBuffers[index] = target;
                maxes[index] = target > max ? target : max;
                const min = mins[index];
                mins[index] = min > target ? target : min;
                data.push({ target, pValue, lastValue });
            }
            // console.log('data.length:' + data.length + '/indexCount:' + indexCount);
            const calced = { state, time, data, lastState };
            peakList.push(calced);
            lastState = state;
        }
        const thresholds = [];
        for (let i = 0; i < targetIndexCount; i++) {
            const max = maxes[i];
            const threshold = max * 0.9;
            thresholds.push(threshold);
        }
        const peakSpanTimes = [];
        let lastPeakTime = 0;
        let lastByte = 0;
        for (const calced of peakList) {
            let isPeaked = false;
            const data = calced.data;
            const state = calced.state;
            const time = calced.time;
            let pValues = [];
            for (let i = 0; i < targetIndexCount; i++) {
                const threshold = thresholds[i];
                const bitData = data[i];
                const pValue = bitData.pValue;
                const lastValue = bitData.lastValue;
                if (pValue < 0 && lastValue > threshold && !isPeaked && state > 0) {
                    isPeaked = true;
                }
                pValues.push(pValue < 0 ? -1 : 1 * (lastValue > threshold ? 2 : 1));
            }
            calced.isPeaked = pValues;
            const byte = this.readByte(data, thresholds, targetIndexCount);
            if (isPeaked) {
                if (lastPeakTime && byte !== lastByte) {
                    const duration = time - lastPeakTime;
                    console.log(data);
                    console.log(byte + '/' + byte);
                    peakSpanTimes.push((cap + duration) * 1 + delimiter + time + delimiter + byte);
                }
                lastPeakTime = time;
            }
            lastByte = byte;
        }
        peakSpanTimes.sort();
        const peakSpanCount = peakSpanTimes.length;
        const peakSpans =
            peakSpanCount < 5
                ? peakSpanTimes
                : peakSpanCount < 10
                ? peakSpanTimes.slice(1, peakSpanCount - 2)
                : peakSpanTimes.slice(
                      Math.floor(peakSpanCount / 10) - 1,
                      Math.floor(peakSpanCount / 90) - 2
                  );
        console.log(maxes);
        console.log(thresholds);
        console.log(peakSpanTimes);
        // console.log(peakSpanTimes.slice(1, 4));
        console.log(peakSpans);
        if (peakSpans.length < 1) {
            return;
        }
        const countMap = {};
        const peakMap = {};
        for (const peakSpan of peakSpans) {
            const tokens = peakSpan.split(delimiter);
            const value = Math.round((tokens[0] * 1 - cap) / spanUnitMs) * spanUnitMs;
            countMap[value] = countMap[value] ? countMap[value] + 1 : 1;
            peakMap[value] = peakMap[value] ? peakMap[value] : tokens[1] * 1;
            accumulator += value;
        }
        const maxKey = this.getMaxCountKey(countMap);
        const firstPeakTime = peakMap[maxKey];
        const spanDuration = this.spanDuration * 1;
        Math.floor(maxKey / spanUnitMs) * spanUnitMs;
        const diff = firstPeakTime - firstTime;
        const spanOffset = Math.ceil(spanDuration / 1.5);
        const offset = diff - Math.floor(diff / spanDuration) * spanDuration + spanOffset;
        let parseCounter = 1;
        const parsed = [];
        console.log(
            'offset:' + offset + '/spanDuration:' + spanDuration + '/firstPeakTime:' + firstPeakTime
        );
        const startTime = firstTime + offset;
        const cache = {};
        let weight = '';
        let lastChar = null;
        let firstChangeChar = null;
        for (const calced of peakList) {
            const data = calced.data;
            const state = calced.state;
            const lastState = calced.lastState;
            const isPeaked = calced.isPeaked;
            const time = calced.time;
            const nextPeakTime = startTime + spanDuration * parseCounter + spanOffset;
            const diff = nextPeakTime - time - spanOffset;
            const byte = this.readByte(data, thresholds, targetIndexCount);
            const char = String.fromCharCode(byte % 256);
            console.log(
                diff +
                    '/' +
                    time +
                    '/' +
                    Math.floor((time - startTime) / spanDuration) +
                    // '/offset:' +
                    // offset +
                    '/state:' +
                    state +
                    '/pc:' +
                    parseCounter +
                    // '/lastState:' +
                    // lastState +
                    '/ls:' +
                    lastState +
                    '/c:' +
                    char +
                    '/b:' +
                    byte +
                    '/isPeaked:' +
                    isPeaked
            );
            const isReadable = state > 0 || lastState > 0;
            if (isReadable && CHARS.test(char)) {
                weight = spanDuration / 2 - Math.abs(diff);
                firstChangeChar = !firstChangeChar && char !== lastChar ? char : firstChangeChar;
                const currentWeight =
                    char !== lastChar
                        ? firstChangeChar === char
                            ? weight * 5
                            : weight * 4
                        : weight;
                cache[char] = cache[char] ? cache[char] + currentWeight : currentWeight;
            }
            if (nextPeakTime <= time) {
                const targetChar = this.getMaxCountKey(cache);
                console.log(nextPeakTime + '/' + time + '/' + targetChar + '/' + parseCounter);
                parseCounter++;
                if (targetChar !== null) {
                    parsed.push(targetChar);
                    lastChar = targetChar;
                    weight = 1;
                    firstChangeChar = null;
                }
                this.clearMap(cache);
            }
        }
        this.output(parsed);
        console.log(parsed);
        return parsed;
    }
    getMaxCountKey(countMap) {
        let maxValue = 0;
        let maxKey = null;
        for (const [key, value] of Object.entries(countMap)) {
            if (maxValue < value) {
                maxValue = value;
                maxKey = key;
            }
        }
        return maxKey;
    }
    clearMap(obj) {
        const keys = Object.keys(obj);
        for (const key of keys) {
            delete obj[key];
        }
    }
    readByte(data, thresholds, targetIndexCount) {
        let byte = 0;
        for (let i = 0; i < targetIndexCount; i++) {
            const threshold = thresholds[i];
            const bitData = data[i].lastValue;
            // console.log('threshold:' + threshold + '/bitData:' + bitData);
            if (threshold < bitData) {
                byte += (1 << i) * 1;
            }
        }
        return byte;
    }
    async decode() {
        const buffer = new Uint8Array(this.analyser.frequencyBinCount);
        this.isStop = false;
        const thesholdMs = 15;
        const thesholdMsEnd = thesholdMs * 10;
        const now = Date.now();
        const futurOffset = 1000 * 60 * 60 * 24;
        const state = {
            now: now,
            lastOn: now + futurOffset,
            lastEnd: 0,
            isRecording: false,
        };
        const targetIndexes = this.calcTargetIndexes();
        const indexCount = targetIndexes.length * 5;
        const targetIndexCount = this.frequencies.length;
        const bufferedData = [];
        const binVlueThreshold = this.binVlueThreshold;
        console.log('decode');
        while (true) {
            const start = Date.now();
            this.analyser.getByteFrequencyData(buffer);
            const selected = [];
            let max = 0;
            let min = 255;
            for (const index of targetIndexes) {
                const target = buffer[index];
                max = target > max ? target : max;
                min = target > min ? min : target;
                selected.push(target);
            }
            selected.push(start);
            const selectedSate =
                max >= binVlueThreshold && min >= binVlueThreshold / 2
                    ? 255
                    : max < binVlueThreshold && min < binVlueThreshold / 2
                    ? 0
                    : 128;
            selected.push(selectedSate);
            // console.log('state.isRecording:' + state.isRecording);
            // console.log('state.isRecording:' + state.isRecording + '/selectedSate:' + selectedSate);
            if (state.isRecording) {
                state.lastEnd = selectedSate ? start : state.lastEnd;
                if (start - state.lastEnd > thesholdMsEnd) {
                    state.isRecording = false;
                    this.parse(bufferedData, indexCount, targetIndexCount);
                    bufferedData.splice(0, bufferedData.length);
                } else {
                    bufferedData.push(selected);
                }
            } else {
                state.lastOn =
                    selectedSate === 255
                        ? state.lastOn > start
                            ? start
                            : state.lastOn
                        : start + futurOffset;
                if (start - state.lastOn >= thesholdMs) {
                    state.isRecording = true;
                    state.lastOn = start + futurOffset;
                }
            }
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
        spanDulationId = 'span-dulation',
        outputId = 'output',
        clearId = 'clearBtn',
        codeId = 'code'
    ) {
        this.reciver = new Reciver();
        this.binVlueThresholdElm = V.gid(binVlueThresholdId);
        this.spanDulationElm = V.gid(spanDulationId);
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
        V.ael(this.spanDulationElm, 'change', (e) => {
            this.reciver.setSpanDulation(e.target.value);
        });
        this.reciver.spanDuration = this.spanDulationElm.value * 1;
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
    buildDecoder(binVlueThresholdId, spanDurationId, outputId, clearId, codeId) {
        this.decoder = new Decoder(binVlueThresholdId, spanDurationId, outputId, clearId, codeId);
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
const spanDurationId = 'span-duration';
const outputId = 'decoder-output';
const clearId = 'decode-clear';
const codeId = 'decode-code';
wam.buildDecoder(binVlueThresholdId, spanDurationId, outputId, clearId, codeId);
const encodBtnId = 'encode-action';
const encodeInputId = 'encode-input';
const clearBtnId = 'encode-clear';
const pauseDurationId = 'pause-duration';
const activeDurationId = 'active-duration';
wam.buildEncoder(encodBtnId, clearBtnId, encodeInputId, pauseDurationId, activeDurationId);
