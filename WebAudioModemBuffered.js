import { V } from './util/V.js';
import { Oscillator, Reciver } from './WebAudioModemBufferedCore.js';

V.init();
class Encoder {
    constructor(
        encodBtnId,
        clearBtnId,
        encodeInputId,
        pauseDurationId,
        activeDurationId,
        progressId
    ) {
        this.Oscillator = new Oscillator();
        const encodBtnElm = V.gid(encodBtnId);
        const clearBtnElm = V.gid(clearBtnId);
        const encodeInputElm = V.gid(encodeInputId);
        const pauseDurationElm = V.gid(pauseDurationId);
        const activeDurationElm = V.gid(activeDurationId);
        const progressElm = V.gid(progressId);
        const profressFunc = (progress) => {
            progressElm.style.width = progress * 100 + '%';
        };
        V.ael(encodBtnElm, 'click', async () => {
            V.sa(encodBtnElm, 'disabled', 'disabled');
            await this.Oscillator.encode(encodeInputElm.value, () => {
                encodBtnElm.removeAttribute('disabled');
            });
            setTimeout(() => {
                encodBtnElm.blur();
                profressFunc(0);
            }, 10000);
        });
        V.ael(clearBtnElm, 'click', () => {
            encodeInputElm.value = '';
            clearBtnElm.blur();
            profressFunc(0);
        });
        this.Oscillator.pauseDuration = pauseDurationElm.value * 1;
        V.ael(pauseDurationElm, 'change', (e) => {
            this.Oscillator.pauseDuration = e.target.value * 1;
        });
        this.Oscillator.activeDuration = activeDurationElm.value * 1;
        V.ael(activeDurationElm, 'change', (e) => {
            this.Oscillator.activeDuration = e.target.value * 1;
        });

        this.Oscillator.onProgress = profressFunc;
        progressElm.style.width = 0 + '%';
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
        codeId = 'code',
        recieverSateId = 'reciever-sate',
        unsherpMaskGainId = 'unsherp-mask-gain'
    ) {
        this.reciver = new Reciver();
        this.binVlueThresholdElm = V.gid(binVlueThresholdId);
        this.spanDulationElm = V.gid(spanDulationId);
        this.outputElm = V.gid(outputId);
        this.clearbtnElm = V.gid(clearId);
        this.codeElm = V.gid(codeId);
        this.recieverSateElm = V.gid(recieverSateId);
        this.unsherpMaskGainElm = V.gid(unsherpMaskGainId);
        V.ael(this.clearbtnElm, 'click', (e) => {
            this.outputElm.value = '';
            e.target.blur();
        });
        this.reciver.stop();
        V.ael(this.binVlueThresholdElm, 'change', (e) => {
            this.reciver.setBinVlueThreshold(e.target.value);
        });
        this.reciver.binVlueThreshold = this.binVlueThresholdElm.value * 1;
        V.ael(this.spanDulationElm, 'change', (e) => {
            this.reciver.setSpanDulation(e.target.value);
        });
        this.reciver.spanDuration = this.spanDulationElm.value * 1;
        V.ael(this.unsherpMaskGainElm, 'change', (e) => {
            this.reciver.setUnsherpMaskGain(e.target.value);
        });
        this.reciver.unsherpMaskGain = this.unsherpMaskGainElm.value * 1;
        this.reciver.onOutput = (input) => {
            // console.log(this.outputElm.value + input);
            this.outputElm.value += input;
        };
        this.reciver.onTrace = (text) => {
            this.codeElm.textContent = text;
        };
        this.reciver.onStateChange = (state) => {
            this.recieverSateElm.textContent = state;
        };
    }
    stop() {
        console.log('stop');
        this.reciver.stop();
    }
    start() {
        console.log('start');
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
    buildDecoder(
        binVlueThresholdId,
        spanDurationId,
        outputId,
        clearId,
        codeId,
        recieverSateId,
        unsherpMaskGainId
    ) {
        this.decoder = new Decoder(
            binVlueThresholdId,
            spanDurationId,
            outputId,
            clearId,
            codeId,
            recieverSateId,
            unsherpMaskGainId
        );
    }
    buildEncoder(
        encodBtnId,
        clearBtnId,
        encodeInputId,
        pauseDurationId,
        activeDurationId,
        progressId
    ) {
        this.encoder = new Encoder(
            encodBtnId,
            clearBtnId,
            encodeInputId,
            pauseDurationId,
            activeDurationId,
            progressId
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
const unsherpMaskGainId = 'unsherp-mask-gain';
const recieverSateId = 'reciever-sate';
const outputId = 'decoder-output';
const clearId = 'decode-clear';
const codeId = 'decode-code';
wam.buildDecoder(
    binVlueThresholdId,
    spanDurationId,
    outputId,
    clearId,
    codeId,
    recieverSateId,
    unsherpMaskGainId
);
const encodBtnId = 'encode-action';
const encodeInputId = 'encode-input';
const clearBtnId = 'encode-clear';
const pauseDurationId = 'pause-duration';
const activeDurationId = 'active-duration';
const progressId = 'progress';
wam.buildEncoder(
    encodBtnId,
    clearBtnId,
    encodeInputId,
    pauseDurationId,
    activeDurationId,
    progressId
);
