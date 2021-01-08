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

it is build as es modules. When try using,You need a http server host.

## impliments
You can use Buffered version as a module.


```
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
 * encode text to sound as modem.
 * @param {string} text for encoding to sound.
 * @param {function} onComplete a callback function at called end.
 */
await oscillator.encode('hello world!', () => {
    alert('encoding is end!');
});

////////////////////Reciver////////////////////////////////
/**
 * @constructor
 * @param {array} frequencies DTMFfrequencies as default.
 * @param {array} fftSize 4096=44100hz/4096=10.7hz/1byte as default.
 * @param {array} smoothingTimeConstant 0.0 (max speed sampling rate) as default.
 * @param {array} minDecibels -68 (db) as default.
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
reciver.setSpanDulation(40);

/**
 * set callbak funk for reciver recived text.
 * if recived codes is invalid, return nothing and this callback method is not called.
 */
reciver.onOutput=(text)=>{
  alert(text);
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
