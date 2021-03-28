import { B64Util } from './util/B64Util.js';
import { ProcessUtil } from './util/ProcessUtil.js';

const subCount = 7;
const harf = Math.floor(subCount / 2);
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
export class Oscillator {
    constructor(frequencies = BaseSetting.frequencies, alertMsg = 'click widow somewehere!.') {
        this.frequencies = frequencies;
        this.frequenciesLen = frequencies.length;
        this.inited = false;
        this.alertMsg = alertMsg;
        window.addEventListener('click', (e) => {
            this.init();
        });
        this.progress = 0;
        this.onProgress = (progress) => {};
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
    mute() {
        for (const osc of this.oscillators) {
            osc.gain.value = 0;
        }
    }
    async encodeCharcode(charCode, duration) {
        if (!this.oscillators) {
            alert(this.alertMsg);
            return;
        }
        for (let i = 0; i < this.frequenciesLen; i++) {
            const osc = this.oscillators[i];
            osc.gain.value = charCode & (1 << i) ? 1 : 0;
        }
        await ProcessUtil.sleep(duration);
    }
    /**
     *
     * @param {string/Uint8Array} text
     */
    convertTextToHaming(text) {
        const result = [];
        const hex = typeof text === 'string' ? B64Util.s2hex(text) : B64Util.u8a2hex(text);
        console.log('hex:' + hex + '/' + hex.length);
        let idx = 0;
        for (const char of hex) {
            idx++;
            const bits = ('0000' + parseInt(char, 16).toString(2)).slice(-4).split('');
            const b1 = bits[0] * 1;
            const b2 = bits[1] * 1;
            const b3 = bits[2] * 1;
            const b4 = bits[3] * 1;
            const c1 = (b1 + b2 + b3) % 2;
            const c2 = (b1 + b3 + b4) % 2;
            const c3 = (b2 + b3 + b4) % 2;
            const i = (b1 + b2 + b3 + b4 + c1 + c2 + c3) % 2;
            const p = i * 1 ? 0 : 1;
            const byte = '' + p + b1 + b2 + b3 + b4 + c1 + c2 + c3;
            result.push(parseInt(byte, 2));
        }
        return result;
    }
    async encode(text, onComplete, onCompleteMute, hasMuteTimeOnEnd) {
        this.init();
        return await this.encodeExec(text, onComplete, onCompleteMute, hasMuteTimeOnEnd);
    }
    async encodeExec(
        text,
        onComplete = () => {},
        onCompleteMute = () => {},
        hasMuteTimeOnEnd = true
    ) {
        this.progress = 0;
        const pause = this.pauseDuration;
        const duration = this.activeDuration;
        const timeBetweenChars = (pause + duration) * 1;
        const hamings = this.convertTextToHaming(text);
        const hamingsLen = hamings.length;
        await this.encodeCharcode(255, duration * 2);
        const start = Date.now();
        let currentDuration = timeBetweenChars;
        const dd = timeBetweenChars * 2;
        const offset = start % timeBetweenChars;
        const times = Math.floor(start / timeBetweenChars);
        for (let i = 0; i < hamingsLen; i++) {
            const target = (times + i) * timeBetweenChars + offset;
            if (pause) {
                await ProcessUtil.sleep(pause * 1);
            }
            await this.encodeCharcode(hamings[i], currentDuration);
            this.progress = (i + 1) / hamingsLen;
            this.onProgressExec();
            const now = Date.now();
            currentDuration = dd - (now - target);
        }
        onCompleteMute();
        this.mute();
        if (hasMuteTimeOnEnd) {
            await ProcessUtil.sleep(timeBetweenChars * hamingsLen);
        }

        this.progress = 1;
        onComplete();
    }
    onProgressExec() {
        setTimeout(() => {
            this.onProgress(this.progress);
        });
    }
    getProgress() {
        return this.progress;
    }
    end() {
        this.progress = 0;
    }
}
export class Reciver {
    static state = {
        STOP: 'stop',
        WAITING: 'waiting',
        RECORDING: 'recording',
        PARSING: 'parsing',
        FAIL: 'fail',
    };
    constructor(
        frequencies = BaseSetting.frequencies,
        fftSize = 4096,
        smoothingTimeConstant = 0.0,
        minDecibels = -68,
        alertMsg = 'click widow somewehere!.'
    ) {
        this.frequencies = frequencies;
        // create audio nodes
        this.fftSize = fftSize;
        this.smoothingTimeConstant = smoothingTimeConstant;
        this.minDecibels = minDecibels;
        // buffer for analyser output
        this.history = [];
        this.inited = false;
        this.alertMsg = alertMsg;
        this.unsherpMaskGain = 1;
        this.onStateChange = () => {};
        window.addEventListener('click', (e) => {
            this.init();
        });
    }
    async init() {
        if (this.inited) {
            return;
        }
        this.inited = true;
        // connect nodes
        this.audioContext = BaseSetting.getAudioContext();
        const analyser = this.audioContext.createAnalyser();
        analyser.fftSize = this.fftSize;
        analyser.smoothingTimeConstant = this.smoothingTimeConstant;
        analyser.minDecibels = this.minDecibels;
        this.analyser = analyser;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const microphone = this.audioContext.createMediaStreamSource(stream);
            console.log(this.analyser);
            microphone.connect(this.analyser);
            this.decode();
        } catch (err) {
            alert('Microphone is required.');
        }
        this.outputType = 'text';
        this.isStop = true;
    }
    setBinVlueThreshold(threshold) {
        this.binVlueThreshold = threshold * 1;
    }
    setSpanDulation(spanDuration) {
        this.spanDuration = spanDuration * 1;
    }
    setUnsherpMaskGain(unsherpMaskGain) {
        this.unsherpMaskGain = unsherpMaskGain * 1;
    }
    setOutputType(outputType = 'text') {
        this.outputType = outputType;
    }
    output(chars) {
        // console.log(chars);
        if (!chars) {
            this.onOutput('');
            return;
        }
        const hex = chars.join('');
        if (!hex) {
            this.onOutput('');
            return;
        }
        // console.log('output hex');
        const text = this.outputType === 'text' ? B64Util.hex2s(hex) : B64Util.hex2u8a(hex);
        this.onOutput(text);
    }
    stop() {
        this.isStop = true;
        this.onStateChange(Reciver.state.STOP);
    }
    start() {
        this.init();
        if (this.isStop) {
            this.isStop = false;
            setTimeout(() => {
                console.log('start decoder');
                this.decode();
            }, 1000);
        }
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
    valitadeHaming(charCode) {
        const bits = ('00000000' + charCode.toString(2)).slice(-8).split('');
        const i = bits[0];
        const b1 = bits[1] * 1;
        const b2 = bits[2] * 1;
        const b3 = bits[3] * 1;
        const b4 = bits[4] * 1;
        const c1 = bits[5] * 1;
        const c2 = bits[6] * 1;
        const c3 = bits[7] * 1;
        const s1 = (b1 + b2 + b3 + c1) % 2;
        const s2 = (b1 + b3 + b4 + c2) % 2;
        const s3 = (b2 + b3 + b4 + c3) % 2;
        const p = (b1 + b2 + b3 + b4 + c1 + c2 + c3) % 2;
        let hex = '';
        let bit = '';
        let isFailed = false;
        const codn = s1 * 1 + s2 * 2 + s3 * 4;
        const isValid = p * 1 === (i * 1 ? 0 : 1);
        const codnSuccess = codn * 1 === 0;
        if (codnSuccess && isValid) {
            bit = '' + b1 + b2 + b3 + b4;
            isFailed = 0;
        } else if (!codnSuccess && !isValid) {
            if (codn === 3) {
                const a = b1 ? 0 : 1;
                bit = '' + a + b2 + b3 + b4;
            } else if (codn === 5) {
                const a = b2 ? 0 : 1;
                bit = '' + b1 + a + b3 + b4;
            } else if (codn === 7) {
                const a = b3 ? 0 : 1;
                bit = '' + b1 + b2 + a + b4;
            } else if (codn === 6) {
                const a = b4 ? 0 : 1;
                bit = '' + b1 + b2 + b3 + a;
            } else {
                bit = '' + b1 + b2 + b3 + b4;
            }
            isFailed = 0;
        } else {
            isFailed = 1;
            bit = '' + b1 + b2 + b3 + b4;
        }
        hex = parseInt(bit, 2).toString(16);
        return { i, hex, isFailed, bit, p, codn };
    }
    parse(bufferedData, indexCount, targetIndexCount, unsherpMaskGain = 1) {
        return new Promise((resolve) => {
            console.log('parse A');
            console.time('parse');

            const result = this.parseExec(
                bufferedData,
                indexCount,
                targetIndexCount,
                unsherpMaskGain
            );
            console.timeEnd('parse');
            resolve(result);
        });
    }
    parsecharContinuous(part, thresholds, targetIndexCount) {
        const charContinuous = [];
        let lastChar = null;
        let startUnixTime = Date.now();
        let endUnixTime = 0;
        for (const calced of part) {
            const data = calced.data;
            const time = calced.time;
            const byte = this.readByte(data, thresholds, targetIndexCount);
            const hamingResult = this.valitadeHaming(byte);
            const char = hamingResult.hex;
            calced.hamingResult = hamingResult;
            calced.byte = byte;
            const state = calced.state;
            const lastState = calced.lastState;
            const isReadable = state > 0 || lastState > 0;
            if (!isReadable) {
                continue;
            }
            if (!hamingResult.isFailed) {
                startUnixTime = time > startUnixTime ? startUnixTime : time;
                endUnixTime = time > endUnixTime ? time : endUnixTime;
            }
            if (char === lastChar) {
                charContinuous.push(hamingResult);
            } else {
                for (const hamingResult of charContinuous) {
                    if (!hamingResult.isFailed) {
                        for (const hamingResult of charContinuous) {
                            hamingResult.isFailed = 0;
                        }
                        break;
                    }
                }
                charContinuous.splice(0, charContinuous.length);
            }
            lastChar = char;
        }
    }
    pursePerPart(part, parsed, lastChar, spanDuration, spanOffset, thresholds, targetIndexCount) {
        // let changeCount = 0;
        const cache = {};
        const cacheNulls = {};
        let nullsCount = 0;
        const nextPeakTime = part.nextPeakTime;
        for (const calced of part) {
            const state = calced.state;
            const lastState = calced.lastState;
            const time = calced.time;
            const diff = nextPeakTime - time - spanOffset;
            const hamingResult = calced.hamingResult;
            const char = hamingResult.hex;
            const isReadable = state > 0 || lastState > 0;
            const weight = spanDuration + 20 * (isReadable ? 2 : 1) - Math.abs(diff);
            const firstChangeChar = char !== lastChar ? char : null;
            const currentWeight =
                char !== lastChar ? (firstChangeChar === char ? weight * 2 : weight * 1) : weight;
            if (!hamingResult.isFailed) {
                cache[char] = cache[char] ? cache[char] + currentWeight : currentWeight;
            } else {
                cacheNulls[char] = cacheNulls[char]
                    ? cacheNulls[char] + currentWeight
                    : currentWeight;
            }
        }
        // console.log(cache);
        const targetChar = this.getMaxCountKey(cache);
        const targetCharNulls = this.getMaxCountKey(cacheNulls);
        // console.log(
        //     'targetChar:' +
        //         targetChar +
        //         '/targetCharNulls:' +
        //         targetCharNulls +
        //         '/weight:' +
        //         weight +
        //         '/spanDuration:' +
        //         spanDuration +
        //         '/diff:' +
        //         diff +
        //         '/spanOffset:' +
        //         spanOffset +
        //         '/time:' +
        //         time +
        //         '/nextPeakTime:' +
        //         nextPeakTime
        // );
        if (targetChar !== null) {
            // changeCount += lastChar !== targetChar ? 1 : 0;
            // const startTime = firstTime + offset;
            this.parsecharContinuous(part, thresholds, targetIndexCount);
            parsed.push(targetChar);
            lastChar = targetChar;
        } else if (targetCharNulls !== null) {
            // console.log(cache);
            // console.log(cacheNulls);
            nullsCount++;
            // changeCount += lastChar !== targetCharNulls ? 1 : 0;
            parsed.push(targetCharNulls);
            lastChar = targetCharNulls;
        } else {
            // console.log(cache);
            // console.log(cacheNulls);
            nullsCount++;
        }
        this.clearMap(cache);
        this.clearMap(cacheNulls);
        part.lastChar = lastChar;
        part.nullsCount = nullsCount;
        return { lastChar, nullsCount };
    }
    parseParUnitTime(
        peakList,
        k,
        spanDuration,
        targetCharCount,
        startTimeInput,
        thresholds,
        targetIndexCount
    ) {
        const parsed = [];
        let parseCounter = 1;
        let changeCount = 0;
        let nullsCount = 0;
        const spanOffset = Math.ceil(spanDuration / 2) + Math.floor((spanDuration * k) / 10);
        const startTime = startTimeInput - Math.ceil(spanDuration / 2);
        console.log(
            'parseParUnitTime k:' +
                k +
                '/spanDuration:' +
                spanDuration +
                '/spanOffset:' +
                spanOffset
        );
        const parts = {};
        for (const calced of peakList) {
            const part = parts[parseCounter] ? parts[parseCounter] : [];
            parts[parseCounter] = part;
            part.push(calced);
            const nextPeakTime = startTime + spanDuration * parseCounter + spanOffset;
            part.nextPeakTime = nextPeakTime;
            const time = calced.time;
            if (nextPeakTime <= time) {
                parseCounter++;
            }
        }
        console.log(parts);
        let lastChar = null;
        for (const parseCounter in parts) {
            const part = parts[parseCounter];
            const result = this.pursePerPart(
                part,
                parsed,
                lastChar,
                spanDuration,
                spanOffset,
                thresholds,
                targetIndexCount
            );
            changeCount += lastChar === result.lastChar ? 0 : 1;
            lastChar = result.lastChar;
            nullsCount += result.nullsCount;
        }
        const isOdd = targetCharCount % 2;
        console.log(
            'parseParUnitTime parsed targetCharCount:' +
                targetCharCount +
                '/nullsCount:' +
                nullsCount +
                '/changeCount:' +
                changeCount +
                '/parsed.length:' +
                parsed.length
        );
        if (
            targetCharCount === parsed.length - nullsCount - 1 + isOdd ||
            targetCharCount === parsed.length - nullsCount + 0 + isOdd ||
            targetCharCount === parsed.length - nullsCount + 1 + isOdd
        ) {
            console.log(parsed?.join(''));
            return {
                parsedCounts: changeCount - (nullsCount * targetCharCount) / 20,
                parsed: parsed.slice(0, targetCharCount),
            };
        }
        return null;
    }
    preDecode(peakList, thresholds, targetIndexCount) {
        const charContinuous = [];
        let lastChar = null;
        let startUnixTime = Date.now();
        let endUnixTime = 0;
        console.log('parseExec D');
        for (const calced of peakList) {
            const data = calced.data;
            const time = calced.time;
            const byte = this.readByte(data, thresholds, targetIndexCount);
            const hamingResult = this.valitadeHaming(byte);
            const char = hamingResult.hex;
            calced.hamingResult = hamingResult;
            calced.byte = byte;
            const state = calced.state;
            const lastState = calced.lastState;
            const isReadable = state > 0 || lastState > 0;
            if (!isReadable) {
                continue;
            }
            if (!hamingResult.isFailed) {
                startUnixTime = time > startUnixTime ? startUnixTime : time;
                endUnixTime = time > endUnixTime ? time : endUnixTime;
            }
            if (char === lastChar) {
                charContinuous.push(hamingResult);
            } else {
                let isSuccess = false;
                for (const hamingResult of charContinuous) {
                    if (!hamingResult.isFailed) {
                        isSuccess = true;
                        break;
                    }
                }
                if (isSuccess) {
                    for (const hamingResult of charContinuous) {
                        hamingResult.isFailed = 0;
                    }
                }
                charContinuous.splice(0, charContinuous.length);
            }
            lastChar = char;
        }
        return { startUnixTime, endUnixTime };
    }
    unsharpFilter(list, indexCount, k = 1) {
        const len = list.length;
        const width = indexCount * subCount;
        for (let i = 0; i < len; i++) {
            const row = list[i];
            for (let j = 0; j < width; j++) {
                const kernel = this.getFilterKernel(j, i);
                let amount = 0;
                for (const d of kernel) {
                    if (d.x < 0 || d.y < 0 || d.x >= width || d.y >= len) {
                        continue;
                    }
                    const v = list[d.y][d.x];
                    amount += (v * d.e) / 9;
                }
                row[j] += amount * k;
            }
        }
    }
    getFilterKernel(x, y) {
        return [
            { x: x - 1, y: y - 1, e: -1 },
            { x: x - 0, y: y - 1, e: -1 },
            { x: x + 1, y: y - 1, e: -1 },
            { x: x - 1, y: y - 0, e: -1 },
            { x: x - 0, y: y - 0, e: 8 },
            { x: x + 1, y: y - 0, e: -1 },
            { x: x - 1, y: y + 1, e: -1 },
            { x: x - 0, y: y + 1, e: -1 },
            { x: x + 1, y: y + 1, e: -1 },
        ];
    }
    buildPeakList(bufferedData, targetIndexCount, unsherpMaskGain) {
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
        let lastState = 0;
        const image = [];
        // console.log('parseExec A');
        for (const row of bufferedData) {
            const map = row.pop();
            const state = row.pop();
            const time = row.pop();
            image.push(map);
            const calced = { state, time, data: null, lastState };
            peakList.push(calced);
            lastState = state;
        }

        this.unsharpFilter(image, targetIndexCount, unsherpMaskGain);
        let rowIndex = 0;
        for (const row of image) {
            const data = [];
            for (let i = 0; i < targetIndexCount; i++) {
                const index = i; //Math.floor(i / 5);
                const offseted = index * subCount + harf + 1;
                const target = row[offseted];
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
            peakList[rowIndex].data = data;
            // console.log('parseExec A data.length:' + data.length + '/indexCount:' + indexCount);
            rowIndex++;
        }
        return { peakList, maxes };
    }
    parseExec(bufferedData, indexCount, targetIndexCount, unsherpMaskGain) {
        console.log(
            'parse bufferedData.length:' +
                bufferedData.length +
                '/indexCount:' +
                indexCount +
                '/targetIndexCount:' +
                targetIndexCount
        );
        const { peakList, maxes } = this.buildPeakList(
            bufferedData,
            targetIndexCount,
            unsherpMaskGain
        );
        if (bufferedData.length < 1 || peakList.length < 1) {
            return false;
        }
        console.log('parseExec B');
        const thresholds = [];
        for (let i = 0; i < targetIndexCount; i++) {
            const max = maxes[i];
            const threshold = max * 0.9;
            thresholds.push(threshold);
        }
        // console.log(maxes);
        // console.log(thresholds);
        // console.log('parseExec C');
        const spanDuration = this.spanDuration * 1;
        const offset = Math.ceil(spanDuration * 1.1);
        const firstTime = peakList[0].time;
        // console.log(
        //     'offset:' + offset + '/spanDuration:' + spanDuration
        //     //+ '/firstPeakTime:' + firstPeakTime
        // );
        const startTime = firstTime + offset;
        const { endUnixTime, startUnixTime } = this.preDecode(
            peakList,
            thresholds,
            targetIndexCount
        );
        // console.log('parseExec E');
        const targetCharCount = Math.floor((endUnixTime - startUnixTime) / spanDuration);
        const isOdd = targetCharCount % 2;
        console.log(peakList);
        const parsedCounts = {};
        const parsedMax = {};
        for (let k = 0; k < 5; k++) {
            const result = this.parseParUnitTime(
                peakList,
                k,
                spanDuration,
                targetCharCount,
                startTime,
                thresholds,
                targetIndexCount
            );
            if (result) {
                parsedCounts[k + '_'] = result.parsedCounts;
                parsedMax[k + '_'] = result.parsed;
            }
        }
        // console.log('parseExec F');
        const maxK = this.getMaxCountKey(parsedCounts);
        console.log(parsedCounts);
        const parsed = parsedMax[maxK];
        console.log(parsed ? parsed.join('') : null);
        try {
            this.output(parsed);
        } catch (e) {
            console.error(e);
            return null;
        }
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
        this.init();
        this.onStateChange(Reciver.state.WAITING);
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
        console.log('decode');
        while (true) {
            const binVlueThreshold = this.binVlueThreshold;
            const unsherpMaskGain = this.unsherpMaskGain;
            const start = Date.now();
            this.analyser.getByteFrequencyData(buffer);
            const selected = [];
            const selectedMap = [];
            let max = 0;
            let min = 255;
            for (const index of targetIndexes) {
                for (let i = 0; i < subCount; i++) {
                    const offset = i - harf;
                    selectedMap.push(buffer[index + offset]);
                }
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
            selected.push(selectedMap);
            // console.log(buffer);
            // console.log('state.isRecording:' + state.isRecording);
            // console.log('state.isRecording:' + state.isRecording + '/selectedSate:' + selectedSate);
            if (state.isRecording) {
                state.lastEnd = selectedSate ? start : state.lastEnd;
                if (start - state.lastEnd > thesholdMsEnd) {
                    this.onStateChange(Reciver.state.PARSING);
                    const result = await this.parse(
                        bufferedData,
                        indexCount,
                        targetIndexCount,
                        unsherpMaskGain
                    );
                    // console.log('result:' + result);
                    if (result) {
                        state.isRecording = false;
                        this.onStateChange(Reciver.state.WAITING);
                    } else {
                        this.onStateChange(Reciver.state.FAIL);
                        setTimeout(() => {
                            state.isRecording = false;
                            this.onStateChange(Reciver.state.WAITING);
                        }, 3000);
                    }
                    bufferedData.splice(0, bufferedData.length);
                    // console.log(bufferedData);
                    await ProcessUtil.sleep(100);
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
                    this.onStateChange(Reciver.state.RECORDING);
                    state.isRecording = true;
                    state.lastOn = start + futurOffset;
                }
            }
            await ProcessUtil.sleep(0);
            if (this.isStop) {
                console.log('stop decoder');
                break;
            }
        }
    }
}
