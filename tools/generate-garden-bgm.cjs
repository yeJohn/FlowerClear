const fs=require('fs');

const rate=22050;
const duration=32;
const frames=rate*duration;
const samples=new Float64Array(frames);
const tempo=90;
const beat=60/tempo;
const note=midi=>440*Math.pow(2,(midi-69)/12);
const addTone=(start,length,midi,gain,kind='bell')=>{
    const from=Math.floor(start*rate),to=Math.min(frames,Math.floor((start+length)*rate));
    const frequency=note(midi);
    for(let i=from;i<to;i++){
        const t=(i-from)/rate,p=t/length;
        const attack=Math.min(1,t/.035),release=Math.min(1,(length-t)/.22);
        const envelope=attack*release*(kind==='bell'?Math.exp(-2.1*p):(.72+.28*Math.cos(Math.PI*p)));
        const phase=2*Math.PI*frequency*t;
        const tone=kind==='bell'
            ?Math.sin(phase)+.28*Math.sin(phase*2)+.12*Math.sin(phase*3)
            :Math.sin(phase)+.18*Math.sin(phase*2);
        samples[i]+=tone*gain*envelope;
    }
};

// Eight bright, seamless garden phrases: Cmaj7 – Fmaj7 – Am7 – G6.
const chords=[[60,64,67,71],[65,69,72,76],[57,60,64,67],[55,59,62,64]];
const melody=[76,79,81,79,76,74,72,74,76,79,84,81,79,76,74,72];
for(let bar=0;bar<12;bar++){
    const start=bar*4*beat,chord=chords[bar%4];
    chord.forEach((m,index)=>addTone(start,4*beat,m-12,.035,'pad'));
    for(let step=0;step<8;step++)addTone(start+step*beat/2,beat*.7,chord[step%4]+12,.075);
    for(let step=0;step<4;step++)addTone(start+step*beat,beat*.88,melody[(bar*4+step)%melody.length],.052,'pad');
}

// Sparse high notes suggest birds without becoming a sound effect.
[[3.1,91],[7.4,88],[12.2,93],[18.0,91],[23.4,88],[28.1,93]].forEach(([t,m])=>{
    addTone(t,.18,m,.035);addTone(t+.2,.14,m+2,.025);
});

// Gentle deterministic air texture and a short loop fade at both edges.
let seed=142857;
for(let i=0;i<frames;i++){
    seed=(seed*1664525+1013904223)>>>0;
    const air=(seed/0xffffffff*2-1)*.0025;
    const edge=Math.min(1,i/(rate*.35),(frames-i-1)/(rate*.35));
    samples[i]=(samples[i]+air)*Math.max(0,edge);
}

const dataBytes=frames*2,buffer=Buffer.alloc(44+dataBytes);
buffer.write('RIFF',0);buffer.writeUInt32LE(36+dataBytes,4);buffer.write('WAVE',8);
buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);
buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);
buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
buffer.write('data',36);buffer.writeUInt32LE(dataBytes,40);
for(let i=0;i<frames;i++){
    const value=Math.max(-1,Math.min(1,samples[i]*.78));
    buffer.writeInt16LE(Math.round(value*32767),44+i*2);
}
fs.writeFileSync('assets/resources/audio/garden_bgm.wav',buffer);
console.log(`Generated garden_bgm.wav: ${duration}s, ${rate} Hz, mono`);
