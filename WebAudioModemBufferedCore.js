import { B64Util } from './util/B64Util.js';
import { ProcessUtil } from './util/ProcessUtil.js';
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
    mute() {
        for (const osc of this.oscillators) {
            osc.gain.value = 0;
        }
    }
    async encodeCharcode(charCode, duration) {
        for (let i = 0; i < this.frequenciesLen; i++) {
            const osc = this.oscillators[i];
            osc.gain.value = charCode & (1 << i) ? 1 : 0;
        }
        await ProcessUtil.sleep(duration);
    }
    convertTextToHaming(text) {
        const result = [];
        const hex = B64Util.s2hex(text);
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
    async encode(text, onComplete) {
        const pause = this.pauseDuration;
        const duration = this.activeDuration;
        const timeBetweenChars = (pause + duration) * 1;
        const hamings = this.convertTextToHaming(text);
        const textLen = hamings.length;
        await this.encodeCharcode(255, duration * 2);
        const start = Date.now();
        let currentDuration = timeBetweenChars;
        const dd = timeBetweenChars * 2;
        const offset = start % timeBetweenChars;
        const times = Math.floor(start / timeBetweenChars);
        for (let i = 0; i < textLen; i++) {
            const target = (times + i) * timeBetweenChars + offset;
            if (pause) {
                await ProcessUtil.sleep(pause * 1);
            }
            await this.encodeCharcode(hamings[i], currentDuration);
            const now = Date.now();
            currentDuration = dd - (now - target);
        }
        this.mute();
        await ProcessUtil.sleep(timeBetweenChars * textLen);
        onComplete();
    }
}
export class Reciver {
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
        const hex = chars.join('');
        console.log(hex);
        const text = B64Util.hex2s(hex);
        this.onOutput(text);
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
    parse(bufferedData, indexCount, targetIndexCount) {
        console.log(
            'parse bufferedData.length:' +
                bufferedData.length +
                '/indexCount:' +
                indexCount +
                '/targetIndexCount:' +
                targetIndexCount
        );
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
        console.log(maxes);
        console.log(thresholds);
        if (bufferedData.length < 1) {
            return;
        }
        const spanDuration = this.spanDuration * 1;
        const offset = Math.ceil(spanDuration * 1.1);
        console.log(
            'offset:' + offset + '/spanDuration:' + spanDuration
            //+ '/firstPeakTime:' + firstPeakTime
        );
        const startTime = firstTime + offset;
        const charContinuous = [];
        let lastChar = null;
        let startUnixTime = Date.now();
        let endUnixTime = 0;
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
        const targetCharCount = Math.floor((endUnixTime - startUnixTime) / spanDuration);
        const isOdd = targetCharCount % 2;
        console.log(peakList);
        const parsedCounts = {};
        const parsedMax = {};
        const cache = {};
        const cacheNulls = {};
        for (let k = 0; k < 5; k++) {
            console.log('k:' + k);
            const parsed = [];
            let parseCounter = 1;
            let weight = '';
            let lastChar = null;
            let firstChangeChar = null;
            let changeCount = 0;
            let nullsCount = 0;
            let samplingCount = 0;
            const spanOffset = Math.ceil(spanDuration / 0.9) + 3 * k;
            for (const calced of peakList) {
                const state = calced.state;
                const lastState = calced.lastState;
                const time = calced.time;
                const nextPeakTime = startTime + spanDuration * parseCounter + spanOffset;
                const diff = nextPeakTime - time - spanOffset;
                const hamingResult = calced.hamingResult;
                const char = hamingResult.hex;
                // console.log(
                //     diff +
                //         '/' +
                //         time +
                //         '/' +
                //         Math.floor((time - startTime) / spanDuration) +
                //         // '/offset:' +
                //         // offset +
                //         '/state:' +
                //         state +
                //         '/pc:' +
                //         parseCounter +
                //         // '/lastState:' +
                //         // lastState +
                //         '/ls:' +
                //         lastState +
                //         '/c:' +
                //         char +
                //         '/bit:' +
                //         hamingResult.bit +
                //         '/i:' +
                //         hamingResult.i +
                //         '/p:' +
                //         hamingResult.p +
                //         '/codn:' +
                //         hamingResult.codn +
                //         '/b:' +
                //         calced.splicedcxbyte +
                //         // '/isPeaked:' +
                //         // isPeaked +
                //         '/' +
                //         hamingResult.isFailed
                // );
                const isReadable = state > 0 || lastState > 0;
                if (isReadable) {
                    weight = spanDuration + 20 - Math.abs(diff);
                    firstChangeChar =
                        firstChangeChar === null && char !== lastChar ? char : firstChangeChar;
                    const currentWeight =
                        char !== lastChar
                            ? firstChangeChar === char
                                ? weight * 2
                                : weight * 1
                            : weight;
                    if (!hamingResult.isFailed) {
                        cache[char] = cache[char] ? cache[char] + currentWeight : currentWeight;
                    } else {
                        cacheNulls[char] = cacheNulls[char]
                            ? cacheNulls[char] + currentWeight
                            : currentWeight;
                    }
                }
                if (nextPeakTime <= time) {
                    const targetChar = this.getMaxCountKey(cache);
                    const targetCharNulls = this.getMaxCountKey(cacheNulls);
                    console.log(
                        nextPeakTime +
                            '/' +
                            time +
                            '/' +
                            targetChar +
                            '/' +
                            targetCharNulls +
                            '/' +
                            parseCounter +
                            '/isReadable:' +
                            isReadable +
                            '/' +
                            samplingCount
                    );
                    parseCounter++;
                    if (targetChar !== null) {
                        changeCount += lastChar !== targetChar ? 1 : 0;
                        parsed.push(targetChar);
                        lastChar = targetChar;
                    } else if (targetCharNulls !== null) {
                        console.log(cache);
                        console.log(cacheNulls);
                        nullsCount++;
                        changeCount += lastChar !== targetCharNulls ? 1 : 0;
                        parsed.push(targetCharNulls);
                        lastChar = targetCharNulls;
                    } else {
                        console.log(cache);
                        console.log(cacheNulls);
                        nullsCount++;
                    }
                    weight = 1;
                    firstChangeChar = null;
                    this.clearMap(cache);
                    this.clearMap(cacheNulls);
                    samplingCount = 0;
                }

                samplingCount++;
            }

            console.log(
                'targetCharCount:' +
                    targetCharCount +
                    '/parsed.length :' +
                    parsed.length +
                    '/startUnixTime:' +
                    startUnixTime +
                    '/endUnixTime:' +
                    endUnixTime +
                    '/parseCounter:' +
                    parseCounter +
                    '/nullsCount:' +
                    nullsCount
            );
            if (
                targetCharCount === parsed.length - nullsCount + 1 + isOdd ||
                targetCharCount === parsed.length - nullsCount + 2 + isOdd ||
                targetCharCount === parsed.length - nullsCount + 3 + isOdd
            ) {
                parsedCounts[k + '_'] = changeCount - (nullsCount * targetCharCount) / 20;
                parsedMax[k + '_'] = parsed;
            }
        }
        const maxK = this.getMaxCountKey(parsedCounts);
        console.log(parsedCounts);
        const parsed = parsedMax[maxK];
        console.log(parsed);
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
            await ProcessUtil.sleep(0);
            if (this.isStop) {
                break;
            }
        }
    }
}
