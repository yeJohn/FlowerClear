const fs = require('fs');
const path = require('path');

const rate = 22050;
const output = path.resolve(__dirname, '../assets/resources/audio');
const tone = (frequency, time, phase = 0) => Math.sin(2 * Math.PI * frequency * time + phase);

function writeWave(name, duration, render) {
  const count = Math.round(duration * rate);
  const buffer = Buffer.allocUnsafe(44 + count * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + count * 2, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36);
  buffer.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    const sample = Math.max(-0.98, Math.min(0.98, render(i / rate)));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path.join(output, name), buffer);
  process.stdout.write(`${name}: ${duration}s, ${buffer.length} bytes\n`);
}

const chords = [
  [261.63, 329.63, 392], [220, 261.63, 329.63], [174.61, 220, 261.63],
  [196, 246.94, 293.66], [261.63, 329.63, 392], [196, 246.94, 392],
];
const melody = [523.25, 659.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25];
writeWave('garden_bgm.wav', 24, (t) => {
  const chord = chords[Math.floor(t / 4) % chords.length];
  let value = 0;
  for (const f of chord) value += 0.105 * tone(f, t) + 0.025 * tone(f * 2, t, 0.3);
  const beatTime = t % 0.75;
  const note = melody[Math.floor(t / 0.75) % melody.length];
  const bell = Math.exp(-4.8 * beatTime);
  value += 0.18 * bell * (tone(note, t) + 0.32 * tone(note * 2.01, t));
  value += 0.018 * tone(1.7, t) * tone(880, t);
  return value * Math.min(1, t / 0.7, (24 - t) / 0.7);
});

writeWave('button_click.wav', 0.16, (t) => {
  const env = Math.exp(-22 * t) * Math.min(1, t / 0.004);
  return env * (0.48 * tone(720, t) + 0.25 * tone(1080, t, 0.2));
});

const matchNotes = [523.25, 659.25, 783.99];
writeWave('match_triple.wav', 0.82, (t) => {
  let value = 0;
  for (let n = 0; n < 3; n++) {
    const local = t - n * 0.12;
    if (local < 0) continue;
    const env = Math.exp(-5.2 * local) * Math.min(1, local / 0.008);
    value += env * (0.34 * tone(matchNotes[n], local) + 0.13 * tone(matchNotes[n] * 2, local, 0.25));
  }
  return value;
});
