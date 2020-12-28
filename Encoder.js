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
class Encoder {
    constructor(encodBtnId, clearBtnId, textareaId, pauseDurationId, activeDurationId) {
        const encodBtnElm = V.gid(encodBtnId);
        const clearBtnElm = V.gid(clearBtnId);
        const textareaElm = V.gid(textareaId);
        this.pauseDurationElm = V.gid(pauseDurationId);
        this.activeDurationElm = V.gid(activeDurationId);
        V.ael(encodBtnElm, 'click', async () => {
            V.sa(encodBtnElm, 'disabled', 'disabled');
            await this.encode(textareaElm.value, () => {
                encodBtnElm.removeAttribute('disabled');
            });
        });
        V.ael(clearBtnElm, 'click', () => {
            textareaElm.value = '';
            clearBtnElm.blur();
        });
        this.init();
        V.init();
    }
    async int() {
        const masterGain = BaseSetting.audioContext.createGain();
        masterGain.gain.value = 1.0 / BaseSetting.frequencies.length;
        const sinusoids = BaseSetting.frequencies.map((f) => {
            const oscillator = BaseSetting.audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = f;
            oscillator.start();
            return oscillator;
        });
        const oscillators = BaseSetting.frequencies.map((f) => {
            const volume = BaseSetting.audioContext.createGain();
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
        masterGain.connect(BaseSetting.audioContext.destination);
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

    async encode(text, onComplete) {
        const pause = this.pauseDurationElm.value * 1;
        const duration = this.activeDurationElm.value * 1;
        const timeBetweenChars = pause + duration;
        const chars = text.split('');
        const textLen = chars.length;
        for (let i = 0; i < textLen; i++) {
            await ProsessUtil.sleep(timeBetweenChars * 1);
            await this.encodeChar(char, duration);
        }
        await ProsessUtil.sleep(timeBetweenChars * textLen);
        onComplete();
    }
}
