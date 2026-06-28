// UMD module: usable in the Electron renderer (window.DebriefWav) and in Node tests (require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DebriefWav = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Clamp a float sample to the signed 16-bit range.
  function floatTo16(sample) {
    const s = Math.max(-1, Math.min(1, sample));
    return s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // Encode a mono Float32 buffer ([-1, 1]) as a 16-bit PCM WAV.
  // Returns an ArrayBuffer (browser) that can be wrapped in a Blob, or Buffer-able in Node.
  function encodeWav(float32, sampleRate) {
    const numSamples = float32.length;
    const bytesPerSample = 2;
    const blockAlign = bytesPerSample; // mono
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeString(offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // audio format = PCM
    view.setUint16(22, 1, true); // channels = mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++, offset += 2) {
      view.setInt16(offset, floatTo16(float32[i]), true);
    }
    return buffer;
  }

  // Root-mean-square level of a Float32 buffer — used to skip near-silent windows.
  function rms(float32) {
    if (!float32.length) return 0;
    let sum = 0;
    for (let i = 0; i < float32.length; i++) sum += float32[i] * float32[i];
    return Math.sqrt(sum / float32.length);
  }

  return { encodeWav, rms, floatTo16 };
});
