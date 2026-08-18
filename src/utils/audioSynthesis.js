// Web Audio API Synthesis Utility for Pomodoro Timer
// 100% offline, zero external dependencies or file downloads

let audioCtx = null;
let currentAmbientNodes = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a synthesized alert sound when timer finishes
 * @param {'bell' | 'chime' | 'gong' | 'digital'} soundType 
 * @param {number} volume 0 to 1
 */
export function playAlarmSound(soundType = 'bell', volume = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);
    masterGain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (soundType === 'bell') {
      // Tibetan / Singing Bowl style with rich harmonics
      const freqs = [440, 880, 1320, 1760];
      const gains = [0.6, 0.3, 0.15, 0.08];
      const decays = [3.2, 2.5, 1.8, 1.2];

      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f + (i * 1.5), now); // slight detune

        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(gains[i], now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);

        osc.connect(g);
        g.connect(masterGain);

        osc.start(now);
        osc.stop(now + decays[i]);
      });
    } else if (soundType === 'chime') {
      // Ascending C-Major chord chime sparkle (C5, E5, G5, B5, C6)
      const notes = [523.25, 659.25, 783.99, 987.77, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const startTime = now + idx * 0.12;
        const duration = 1.6;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        g.gain.setValueAtTime(0, startTime);
        g.gain.linearRampToValueAtTime(0.35, startTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(g);
        g.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    } else if (soundType === 'gong') {
      // Deep meditation gong
      const fundamental = 120;
      const partials = [1, 1.48, 2.05, 2.8, 3.7];
      partials.forEach((mult, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(fundamental * mult, now);

        const peak = 0.5 / (i + 1);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(peak, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 4.0);

        osc.connect(g);
        g.connect(masterGain);

        osc.start(now);
        osc.stop(now + 4.0);
      });
    } else {
      // Digital beep (double high beep)
      [0, 0.18].forEach((offset) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const startTime = now + offset;
        const duration = 0.1;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, startTime);

        g.gain.setValueAtTime(0, startTime);
        g.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(g);
        g.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    }
  } catch (err) {
    console.error('Audio playback error:', err);
  }
}

/**
 * Generate synthetic ambient focus sound
 * @param {'none' | 'rain' | 'whitenoise' | 'binaural' | 'waves'} type 
 * @param {number} volume 0 to 1
 */
export function startAmbientSound(type, volume = 0.5) {
  stopAmbientSound();
  if (!type || type === 'none') return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);
    masterGain.connect(ctx.destination);

    const activeNodes = {
      masterGain,
      sources: []
    };

    if (type === 'whitenoise') {
      // White noise buffer
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Filter to soften the hiss into smooth air/fan sound
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(masterGain);
      whiteNoise.start();

      activeNodes.sources.push(whiteNoise);
    } else if (type === 'rain') {
      // Pink noise filtered to simulate continuous gentle rain
      const bufferSize = ctx.sampleRate * 3;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }

      const rainSource = ctx.createBufferSource();
      rainSource.buffer = noiseBuffer;
      rainSource.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(1400, ctx.currentTime);

      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(120, ctx.currentTime);

      rainSource.connect(lowpass);
      lowpass.connect(highpass);
      highpass.connect(masterGain);
      rainSource.start();

      activeNodes.sources.push(rainSource);
    } else if (type === 'binaural') {
      // 10Hz Alpha Waves (Focus & Study flow state)
      // Left ear 196 Hz, Right ear 206 Hz
      const merger = ctx.createChannelMerger(2);

      const oscLeft = ctx.createOscillator();
      oscLeft.type = 'sine';
      oscLeft.frequency.setValueAtTime(196, ctx.currentTime);

      const oscRight = ctx.createOscillator();
      oscRight.type = 'sine';
      oscRight.frequency.setValueAtTime(206, ctx.currentTime);

      const gainLeft = ctx.createGain();
      gainLeft.gain.setValueAtTime(0.2, ctx.currentTime);

      const gainRight = ctx.createGain();
      gainRight.gain.setValueAtTime(0.2, ctx.currentTime);

      oscLeft.connect(gainLeft);
      oscRight.connect(gainRight);

      gainLeft.connect(merger, 0, 0);
      gainRight.connect(merger, 0, 1);

      merger.connect(masterGain);

      oscLeft.start();
      oscRight.start();

      activeNodes.sources.push(oscLeft, oscRight);
    } else if (type === 'waves') {
      // Ocean Waves (modulated pink noise with periodic swells)
      const bufferSize = ctx.sampleRate * 4;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.5;
      }

      const waveSource = ctx.createBufferSource();
      waveSource.buffer = noiseBuffer;
      waveSource.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, ctx.currentTime);

      // LFO for wave swells (0.12 Hz = ~8 second wave cycle)
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.12, ctx.currentTime);

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(250, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      waveSource.connect(filter);
      filter.connect(masterGain);

      waveSource.start();
      lfo.start();

      activeNodes.sources.push(waveSource, lfo);
    }

    currentAmbientNodes = activeNodes;
  } catch (err) {
    console.error('Ambient sound error:', err);
  }
}

/**
 * Adjust volume of active ambient sound
 * @param {number} volume 0 to 1
 */
export function setAmbientVolume(volume) {
  if (currentAmbientNodes && currentAmbientNodes.masterGain && audioCtx) {
    try {
      currentAmbientNodes.masterGain.gain.setValueAtTime(
        Math.max(0, Math.min(1, volume)),
        audioCtx.currentTime
      );
    } catch (e) {
      console.log('Error updating volume:', e);
    }
  }
}

/**
 * Stop active ambient sound
 */
export function stopAmbientSound() {
  if (currentAmbientNodes) {
    try {
      currentAmbientNodes.sources.forEach(src => {
        try { src.stop(); } catch (e) {}
        try { src.disconnect(); } catch (e) {}
      });
      if (currentAmbientNodes.masterGain) {
        currentAmbientNodes.masterGain.disconnect();
      }
    } catch (e) {
      console.log('Error stopping ambient:', e);
    }
    currentAmbientNodes = null;
  }
}
