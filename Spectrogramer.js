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
        const analyser = BaseSetting.audioContext.createAnalyser();
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
            const microphone = BaseSetting.audioContext.createMediaStreamSource(stream);
            microphone.connect(this.analyser);
            this.decode();
        } catch (err) {
            alert('Microphone is required.');
        }
        V.init();
    }
    getOnResizeCanvasFunc() {
        resizeCanvas = () => {
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
