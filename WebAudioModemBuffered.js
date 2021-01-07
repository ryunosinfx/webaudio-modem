import { V } from './util/V.js';
import { Oscillator, Reciver } from './WebAudioModemBufferedCore.js';

V.init();
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

export class WebAudioModem {
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
export class WebAudioModemView {
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
