# Web Audio Modem

Encode and decode text using the Web Audio API, to allow offline data transfer between devices.

# Live Demo

## Original version
https://ryunosinfx.github.io/webaudio-modem/index.html

## 1 file version
https://ryunosinfx.github.io/webaudio-modem/WebAudioModem.html

## Buffered version 
8bit/1Code (Hamming code(7,4)+1ParityBit)

https://ryunosinfx.github.io/webaudio-modem/WebAudioModemBuffered.html

It is build as es modules.

When you try using Buffered version,You must prepare a http server and host this html files.

It dose not work load from html files.

## Use as ES Modules
You can use Buffered version as a es module.


```javascript
import { Oscillator, Reciver } from './WebAudioModemBufferedCore.js';
////////////////////Oscillator////////////////////////////////
/**
 * @constructor
 * @param {array} frequencies DTMFfrequencies as default.
 */
const oscillator = new Oscillator();

/**
 * The initialize method. call after user interaction.
 */
oscillator.init();

/**
 * The oscillator active duration time ms par a code.
 */
oscillator.activeDuration=40;

/**
 * The oscillator mute duration time ms after active time par a code.
 */
oscillator.pauseDuration=0;

/**
 * The oscillator call by active times and input oscilating progress 0-1.
 */
oscillator.onProgress=(progress)=>{
  console.log(progress)
};


/**
 * encode text to sound as modem.
 * @param {string, Uint8Array} text for encoding to sound.
 * @param {function} onComplete a callback function at called end. is nullable;
 * @param {function} onCompleteMute a callback function at called end of oscilations. is nullable;
 * @param {boolean} hasMuteTimeOnEnd has wait time as saame as oscilating duration after end of oscilations. default true;
 */
await oscillator.encode('hello world!', () => {
    alert('encoding is end!');
}, () => {
    alert('encoding is oscilating end!');
}),true);

////////////////////Reciver////////////////////////////////
/**
 * @constructor
 * @param {array} frequencies DTMFfrequencies as default.
 * @param {number}} fftSize 4096=44100hz/4096=10.7hz/1byte as default.
 * @param {number} smoothingTimeConstant 0.0 (max speed sampling rate) as default.
 * @param {number} minDecibels -68 (db) as default.
 */
const reciver = new Reciver();

/**
 * set signal volume theshold 0-255. 
 * @param {number} threshold 0-255.
 */
reciver.setBinVlueThreshold(200);

/**
 * The oscillator active duration time ms par a code. if you set pauseDuration>0, then contain with the duration.
 * @param {number} spanDuration duration time ms par a code.
 */
reciver.setSpanDuration(40);

/**
 * Unsharp mask to the Wave shape for bit change timing clarification.
 * @param {number} unsherpMaskGain 0:no effect. 2:Recommendation
 */
reciver.setUnsherpMaskGain(1);

/**
 * The output data type. Default output type is string.
 * @param {string} outputType text or Uint8Array.
 */
reciver.setOutputType("text" or "Uint8Array");

/**
 * set callbak funk for reciver recived text.
 * if recived codes is invalid, return nothing and this callback method is not called.
 */
reciver.onOutput=(textOrUint8Array)=>{
  alert(textOrUint8Array);
}

/**
 * set callbak funk for reciver state changed.
 * if recived state is changed, return new state(Reciver.state.STOP->(on start)Reciver.state.WAITING->Reciver.state.RECORDING->Reciver.state.PARSING->(on stop)Reciver.state.STOP)
 */
reciver.onStateChange=(newState)=>{
  alert(newState);
}
/**
 * start waiting for oscillator sounding codes.
 */
reciver.start();

/**
 * stop waiting for oscillator sounding codes.
 */
reciver.stop();

```
