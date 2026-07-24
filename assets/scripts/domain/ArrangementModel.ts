import { LevelResult, MoveResult, PropType, TransferLevel, TransferSnapshot, TransferState, VaseStack } from './Types';
class Random {
    constructor(private seed: number) { }
    next() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
    shuffle<T>(a: T[]) { for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    } return a; }
}
export class ArrangementModel {
    readonly state: TransferState;
    readonly props: Record<PropType, number>;
    private history: TransferSnapshot[] = [];
    private shuffleRecoveryActive=false;
    constructor(readonly level: TransferLevel) { this.props = { ...level.props }; this.state = { levelId: level.id, vases: this.buildVases(), remainingTime: level.timeLimit, score: 0, eliminatedGroups: 0, combo: 0, status: 'playing', moves: 0, lastEliminateAt: -99 }; }
    tick(dt: number) { if (this.state.status !== 'playing')
        return; this.state.remainingTime = Math.max(0, this.state.remainingTime - dt); if (!this.state.remainingTime)
        this.state.status = 'failed'; }
    visible(vaseId: string) { const v = this.vase(vaseId); if (!v || this.isLocked(v)) return []; return v.layers[v.layers.length - 1]?.slice() || []; }
    peekLocked(vaseId:string){const v=this.vase(vaseId);return v?.layers[v.layers.length-1]?.slice()||[];}
    nextVisible(vaseId:string){const v=this.vase(vaseId);if(!v||this.isLocked(v)||v.layers.length<2)return[];return v.layers[v.layers.length-2].slice();}
    canReceive(vaseId: string) { const v = this.vase(vaseId); if (!v || this.isLocked(v)) return false; return (v.layers[v.layers.length - 1]?.length || 0) < 3; }
    move(sourceId: string, slotIndex: number, targetId: string): MoveResult { if (this.state.status !== 'playing')
        return this.result(false, [], '当前无法操作'); if (sourceId === targetId)
        return this.result(false, [], '请选择另一个花瓶'); const source = this.vase(sourceId), target = this.vase(targetId); if (!source || !target)
        return this.result(false, [], '没有找到花瓶'); if (this.isLocked(source) || this.isLocked(target))
        return this.result(false, [], '这个花瓶还没有解锁'); const sourceLayer = source.layers[source.layers.length - 1]; if (!sourceLayer?.[slotIndex] || !this.visible(sourceId)[slotIndex])
        return this.result(false, [], '当前没有可移动的花'); if (!this.canReceive(targetId))
        return this.result(false, [], '目标花瓶已经放满'); this.snapshot(); const flower = sourceLayer.splice(slotIndex, 1)[0]; if (!sourceLayer.length)
        source.layers.pop(); let receiving = target.layers[target.layers.length - 1]; if (!receiving) {
        receiving = [];
        target.layers.push(receiving);
    } const filled = receiving!; filled.push(flower); this.state.moves++; const eliminated=this.resolveMatches(targetId);if(this.shuffleRecoveryActive&&eliminated.length){this.softenSingletonTriples();this.densifyShuffleTop();} if (this.state.vases.every(v => !v.layers.length))
        this.state.status = 'won'; return this.result(true, eliminated); }
    useHourglass() { if (!this.consume('hourglass'))
        return false; this.state.remainingTime += 60; return true; }
    useHint() { if (!this.consume('hint'))
        return null; const h = this.findHint(); if (!h)
        this.props.hint++; return h; }
    findHint(): {
        sourceId: string;
        slotIndex: number;
        targetId: string;
    } | null { for (const target of this.state.vases) {
        const layer = this.visible(target.id);
        if (layer.length > 0 && layer.length < 3 && layer.every(f => f === layer[0])) {
            const candidates: { vaseId: string; slotIndex: number }[] = [];
            for (const source of this.state.vases) {
                if (source.id === target.id) continue;
                this.visible(source.id).forEach((flower, index) => {
                    if (flower === layer[0]) candidates.push({ vaseId: source.id, slotIndex: index });
                });
            }
            if (candidates.length >= 3 - layer.length)
                return { sourceId: candidates[0].vaseId, slotIndex: candidates[0].slotIndex, targetId: target.id };
        }
    } const empty = this.state.vases.find(v => this.canReceive(v.id) && !this.visible(v.id).length); if (empty) {
        const seen = new Map<string, {
            vaseId: string;
            slotIndex: number;
        }[]>();
        for (const v of this.state.vases) {
            this.visible(v.id).forEach((f, i) => { const a = seen.get(f) || []; a.push({ vaseId: v.id, slotIndex: i }); seen.set(f, a); });
        }
        const triple = [...seen.values()].find(a => a.length >= 3);
        if (triple)
            return { sourceId: triple[0].vaseId, slotIndex: triple[0].slotIndex, targetId: empty.id };
    } return null; }
    hasUsefulMove(){const active=this.state.vases.filter(v=>!this.isLocked(v)),initial=active.map(v=>v.layers.map(layer=>layer.slice())),encode=(state:string[][][])=>state.map(layers=>layers.map(layer=>layer.join(',')).join('/')).join('|'),queue:{state:string[][][];depth:number}[]=[{state:initial,depth:0}],seen=new Set<string>([encode(initial)]),deadline=Date.now()+8;let cursor=0,checked=0;while(cursor<queue.length&&checked++<6000){if((checked&31)===0&&Date.now()>deadline)return true;const{state,depth}=queue[cursor++];for(const layers of state){const top=layers[layers.length-1];if(top?.length===3&&top.every(f=>f===top[0]))return true;}if(depth>=9)continue;for(let sourceIndex=0;sourceIndex<state.length;sourceIndex++){const sourceTop=state[sourceIndex][state[sourceIndex].length-1];if(!sourceTop?.length)continue;for(let slot=0;slot<sourceTop.length;slot++)for(let targetIndex=0;targetIndex<state.length;targetIndex++){if(sourceIndex===targetIndex)continue;const targetTop=state[targetIndex][state[targetIndex].length-1];if((targetTop?.length||0)>=3)continue;const next=state.map(layers=>layers.map(layer=>layer.slice())),source=next[sourceIndex][next[sourceIndex].length-1],flower=source.splice(slot,1)[0];if(!source.length)next[sourceIndex].pop();let target=next[targetIndex][next[targetIndex].length-1];if(!target){target=[];next[targetIndex].push(target);}target.push(flower);if(target.length===3&&target.every(f=>f===target[0]))return true;const key=encode(next);if(!seen.has(key)){seen.add(key);queue.push({state:next,depth:depth+1});}}}}return false;}
    async hasUsefulMoveAsync(cancelled:()=>boolean=()=>false){const active=this.state.vases.filter(v=>!this.isLocked(v));if(!active.some(v=>(v.layers[v.layers.length-1]?.length||0)<3))return false;const initial=active.map(v=>v.layers.map(layer=>layer.slice())),encode=(state:string[][][])=>state.map(layers=>layers.map(layer=>layer.join(',')).join('/')).join('|'),queue:{state:string[][][];depth:number}[]=[{state:initial,depth:0}],seen=new Set<string>([encode(initial)]);let cursor=0,checked=0;while(cursor<queue.length&&checked++<1600){if(cancelled())return true;if((checked%20)===0)await new Promise<void>(resolve=>setTimeout(resolve,0));const{state,depth}=queue[cursor++];for(const layers of state){const top=layers[layers.length-1];if(top?.length===3&&top.every(f=>f===top[0]))return true;}if(depth>=7)continue;for(let sourceIndex=0;sourceIndex<state.length;sourceIndex++){const sourceTop=state[sourceIndex][state[sourceIndex].length-1];if(!sourceTop?.length)continue;for(let slot=0;slot<sourceTop.length;slot++)for(let targetIndex=0;targetIndex<state.length;targetIndex++){if(sourceIndex===targetIndex)continue;const targetTop=state[targetIndex][state[targetIndex].length-1];if((targetTop?.length||0)>=3)continue;const next=state.map(layers=>layers.map(layer=>layer.slice())),source=next[sourceIndex][next[sourceIndex].length-1],flower=source.splice(slot,1)[0];if(!source.length)next[sourceIndex].pop();let target=next[targetIndex][next[targetIndex].length-1];if(!target){target=[];next[targetIndex].push(target);}target.push(flower);if(target.length===3&&target.every(f=>f===target[0]))return true;const key=encode(next);if(!seen.has(key)){seen.add(key);queue.push({state:next,depth:depth+1});}}}}return false;}
    shuffleVisible(){
        if(this.state.status!=='playing')return false;
        const unlocked=this.state.vases.filter(v=>!this.isLocked(v)),flowers:string[]=[];
        for(const vase of unlocked)for(const layer of vase.layers)flowers.push(...layer);
        if(unlocked.length<3||flowers.length<3)return false;
        const counts=new Map<string,number>();for(const flower of flowers)counts.set(flower,(counts.get(flower)||0)+1);
        const groups:string[]=[],remaining:string[]=[];
        for(const[flower,count]of counts){for(let i=0;i<Math.floor(count/3);i++)groups.push(flower);for(let i=0;i<count%3;i++)remaining.push(flower);}
        if(!groups.length)return false;
        const originalEmpty=unlocked.filter(v=>!v.layers.length).length;
        const rng=new Random(this.level.seed+this.state.moves*97+this.state.eliminatedGroups*991);rng.shuffle(groups);rng.shuffle(remaining);
        const planned:string[][][]=Array.from({length:unlocked.length},()=>[]),groupsPerRow=Math.max(1,Math.floor(unlocked.length/3));
        for(let i=0;i<remaining.length;i++)planned[i%unlocked.length].push([remaining[i]]);
        const batches:string[][]=[];for(let i=0;i<groups.length;i+=groupsPerRow)batches.push(groups.slice(i,i+groupsPerRow));batches.sort((a,b)=>a.length-b.length);
        for(const batch of batches){rng.shuffle(batch);const unused=Array.from({length:unlocked.length},(_,index)=>index);rng.shuffle(unused);for(const flower of batch)for(let flowerIndex=0;flowerIndex<3;flowerIndex++){let choice=unused.findIndex(index=>planned[index][planned[index].length-1]?.[0]!==flower);if(choice<0)choice=0;const vaseIndex=unused.splice(choice,1)[0];planned[vaseIndex].push([flower]);}}
        for(let empty=0;empty<planned.length;empty++){if(planned[empty].length)continue;const donor=planned.findIndex(layers=>layers.length>1);if(donor>=0)planned[empty].push(planned[donor].shift()!);}
        const topOwners=new Map<string,number[]>();
        for(let i=0;i<planned.length;i++){const top=planned[i][planned[i].length-1];if(top?.length===1){const owners=topOwners.get(top[0])||[];owners.push(i);topOwners.set(top[0],owners);}}
        const protectedList=((([...topOwners.values()].find(indices=>indices.length>=3))||[]).slice(0,3)),protectedVases=new Set(protectedList),singleAnchor=protectedList[0]??-1;
        for(let i=0;i<planned.length;i++){
            if(i===singleAnchor)continue;
            const targetSize=protectedVases.has(i)?2:(i%3===0?3:2),layers=planned[i];
            while(layers.length>=2&&(layers[layers.length-1]?.length||0)<targetSize){
                const upper=layers[layers.length-1],lower=layers[layers.length-2],merged=[...lower,...upper];
                if(merged.length>targetSize||new Set(merged).size!==merged.length)break;
                const ghost=layers[layers.length-3];if(!protectedVases.has(i)&&ghost?.some(flower=>merged.indexOf(flower)>=0))break;
                layers.splice(layers.length-2,2,merged);
            }
        }
        const newEmpty=planned.filter(layers=>!layers.length).length,total=planned.reduce((sum,layers)=>sum+layers.reduce((n,layer)=>n+layer.length,0),0);
        if(newEmpty>originalEmpty||total!==flowers.length)return false;
        const previousLayers=unlocked.map(vase=>vase.layers.map(layer=>layer.slice())),previousMoves=this.state.moves,previousRecovery=this.shuffleRecoveryActive,previousHistory=this.history.slice();
        try{
            this.snapshot();
            for(let i=0;i<unlocked.length;i++)unlocked[i].layers=planned[i].map(layer=>layer.slice());
            this.softenSingletonTriples();this.densifyShuffleTop();
            const shuffledTotal=unlocked.reduce((sum,vase)=>sum+vase.layers.reduce((n,layer)=>n+layer.length,0),0);
            if(shuffledTotal!==flowers.length)throw new Error('打乱后的花朵数量不一致');
            this.state.moves++;this.shuffleRecoveryActive=true;return true;
        }catch(error){
            for(let i=0;i<unlocked.length;i++)unlocked[i].layers=previousLayers[i];
            this.state.moves=previousMoves;this.shuffleRecoveryActive=previousRecovery;this.history=previousHistory;
            console.error('[打乱失败] 已恢复打乱前状态',error);return false;
        }
    }
    private softenSingletonTriples(){
        const mix=(target:VaseStack,flower:string)=>{
            const top=target.layers[target.layers.length-1];if(top?.length!==1)return false;
            let sourceLayer:string[]|undefined,sourceIndex=-1;
            for(let layerIndex=target.layers.length-2;layerIndex>=0&&!sourceLayer;layerIndex--){const layer=target.layers[layerIndex],index=layer.findIndex(item=>item!==flower);if(index>=0){sourceLayer=layer;sourceIndex=index;}}
            if(sourceLayer){top.push(sourceLayer.splice(sourceIndex,1)[0]);if(!sourceLayer.length)target.layers.splice(target.layers.indexOf(sourceLayer),1);return true;}
            const donor=this.state.vases.find(v=>{const donorTop=v.layers[v.layers.length-1];return v!==target&&!this.isLocked(v)&&!!donorTop&&donorTop.length>=3&&donorTop.some(item=>item!==flower);});
            if(!donor)return false;const donorTop=donor.layers[donor.layers.length-1];if(!donorTop)return false;const index=donorTop.findIndex(item=>item!==flower);if(index<0)return false;top.push(donorTop.splice(index,1)[0]);return true;
        };
        for(let pass=0;pass<this.state.vases.length*3;pass++){
            const singles=new Map<string,VaseStack[]>();
            for(const vase of this.state.vases){if(this.isLocked(vase))continue;const top=vase.layers[vase.layers.length-1];if(top?.length===1){const owners=singles.get(top[0])||[];owners.push(vase);singles.set(top[0],owners);}}
            const allSingles=[...singles.values()].reduce((all,owners)=>all.concat(owners),[] as VaseStack[]),obvious=[...singles.entries()].find(([,owners])=>owners.length>=3);
            if(!obvious&&allSingles.length<=2)return;
            const targets=obvious?obvious[1].slice(1):allSingles.slice(2);let changed=false;
            for(const target of targets){if(!target?.layers?.length)continue;const flower=target.layers[target.layers.length-1]?.[0];if(flower&&mix(target,flower))changed=true;}
            if(!changed)return;
        }
    }
    private densifyShuffleTop(){
        const active=this.state.vases.filter(v=>!this.isLocked(v)&&v.layers.length).sort((a,b)=>(a.layers[a.layers.length-1]?.length||0)-(b.layers[b.layers.length-1]?.length||0)),reserve=new Set(active.slice(0,2));
        for(const vase of active){
            if(reserve.has(vase))continue;const top=vase.layers[vase.layers.length-1];if(!top)continue;
            while(top.length<3){
                let sourceLayer:string[]|undefined,sourceIndex=-1;
                for(let layerIndex=vase.layers.length-2;layerIndex>=0&&!sourceLayer;layerIndex--){const layer=vase.layers[layerIndex],index=layer.findIndex(flower=>!(top.length===2&&top[0]===top[1]&&flower===top[0]));if(index>=0){sourceLayer=layer;sourceIndex=index;}}
                if(!sourceLayer)break;top.push(sourceLayer.splice(sourceIndex,1)[0]);if(!sourceLayer.length)vase.layers.splice(vase.layers.indexOf(sourceLayer),1);
            }
        }
    }
    useMagic() { if (!this.consume('magic'))
        return []; const found = new Map<string, {
        v: VaseStack;
        i: number;
    }[]>(); for (const v of this.state.vases)
        this.visible(v.id).forEach((f, i) => { const a = found.get(f) || []; a.push({ v, i }); found.set(f, a); }); const group = [...found.values()].find(a => a.length >= 3); if (!group) {
        this.props.magic++;
        return [];
    } this.snapshot(); const chosen = group.slice(0, 3).sort((a, b) => a.v === b.v ? b.i - a.i : 0), removed: string[] = []; for (const x of chosen) {
        const layer = x.v.layers[x.v.layers.length - 1];
        removed.push(layer.splice(x.i, 1)[0]);
        if (!layer.length)
            x.v.layers.pop();
    } this.award();if(this.state.vases.every(v => !v.layers.length))
        this.state.status = 'won'; return removed; }
    unlockByVideo(vaseId: string) { const v = this.vase(vaseId); if (!v?.lock || v.lock.unlocked)
        return false; v.lock.unlocked = true;if(this.state.vases.every(x=>!x.layers.length))this.state.status='won';return true; }
    revive() { this.state.remainingTime = 60; this.state.status = 'playing'; }
    resultData(): LevelResult { const t = this.state.remainingTime, stars = (t >= this.level.starTime[1] ? 3 : t >= this.level.starTime[0] ? 2 : 1) as 1 | 2 | 3; return { stars, remainingTime: t, score: this.state.score + Math.round(t) * 10, coins: 35 + this.level.id * 2 + stars * 15 }; }
    private buildVases() { const vases: VaseStack[] = Array.from({ length: this.level.vaseCount }, (_, i) => ({ id: `vase_${i}`, skinId: `vase_${i % 6 + 1}`, layers: [] })), rng = new Random(this.level.seed);if(this.level.id===1){vases[0].layers.push(['rose','daisy','rose']);vases[1].layers.push(['daisy','rose','daisy']);return vases;}const locked=new Set((this.level.lockedVases||[]).map(x=>x.index)),active=vases.map((_,i)=>i).filter(i=>!locked.has(i)),pool=rng.shuffle(this.level.flowerTypes.slice()),fullRounds=Math.floor(this.level.groupCount/6),remainder=this.level.groupCount%6;for(let g=0;g<remainder;g++){const flower=pool[g%pool.length];vases[active[g%active.length]].layers.push([flower,flower,flower]);}for(let round=0;round<fullRounds;round++){
        const six=Array.from({length:6},(_,i)=>pool[(round*6+i)%pool.length]),put=(index:number,layer:string[])=>vases[active[index]].layers.push(layer);
        if(active.length>=9){for(let i=0;i<6;i++)put(i,[six[i],six[i]]);put(6,[six[0],six[1]]);put(7,[six[2],six[3]]);put(8,[six[4],six[5]]);}
        else if(active.length===8){for(let i=0;i<6;i++)put(i,[six[i],six[i]]);put(6,[six[0],six[1],six[2]]);put(7,[six[3],six[4],six[5]]);}
        else{put(0,[six[0],six[0]]);put(1,[six[1],six[1]]);put(2,[six[2],six[2]]);put(3,[six[0],six[1],six[2]]);put(4,[six[3],six[4],six[5]]);put(5,[six[3],six[4],six[5]]);put(6,[six[3],six[4],six[5]]);}
    } for (let i=0;i<(this.level.lockedVases||[]).length;i++){const lock=this.level.lockedVases![i],v=vases[lock.index];if(v&&lock.type==='flowers'){const a=pool[(fullRounds*6+remainder+i)%pool.length],d=pool[(fullRounds*6+remainder+i+3)%pool.length],e=pool[(fullRounds*6+remainder+i+5)%pool.length];v.layers.push([d,e,a],[a,d,e]);vases[active[0]].layers.push([a]);vases[active[1]].layers.push([d]);vases[active[2]].layers.push([e]);}}const mixable:string[][]=[];for(const vase of vases)for(const layer of vase.layers)if(layer.length===3)mixable.push(layer);const tokens:string[]=[];for(const layer of mixable)tokens.push(...layer);for(let attempt=0;attempt<120&&mixable.some(layer=>layer.every(f=>f===layer[0]));attempt++){rng.shuffle(tokens);for(let i=0;i<mixable.length;i++)mixable[i].splice(0,3,...tokens.slice(i*3,i*3+3));} for (const lock of this.level.lockedVases || []) {
        const v = vases[lock.index];
        if (v)
            v.lock = { type: lock.type, required: lock.required || 0, unlocked: false };
    } return vases; }
    private award() { const now = this.level.timeLimit - this.state.remainingTime; this.state.combo = now - this.state.lastEliminateAt <= 7 ? this.state.combo + 1 : 1; this.state.lastEliminateAt = now; this.state.eliminatedGroups++; this.state.score += 150 + this.state.combo * 60; for (const v of this.state.vases) {
        if (v.lock?.type === 'flowers' && !v.lock.unlocked && this.state.eliminatedGroups * 3 >= v.lock.required){
            v.lock.unlocked = true;
        }
    } }
    private resolveMatches(vaseId:string){const eliminated:string[]=[],vase=this.vase(vaseId);if(!vase||this.isLocked(vase))return eliminated;const layer=vase.layers[vase.layers.length-1];if(layer?.length===3&&layer.every(f=>f===layer[0])){eliminated.push(...layer);vase.layers.pop();this.award();}return eliminated;}
    private vase(id: string) { return this.state.vases.find(v => v.id === id); }
    private isBuffer(v: VaseStack) { const index = Number(v.id.replace('vase_', '')); return Number.isFinite(index) && index >= 5; }
    private isLocked(v: VaseStack) { return !!v.lock && !v.lock.unlocked; }
    private mainDepth() { return Math.max(0, ...this.state.vases.filter(v => !this.isBuffer(v)).map(v => v.layers.length)); }
    private consume(p: PropType) { if (this.state.status !== 'playing' || this.props[p] <= 0)
        return false; this.props[p]--; return true; }
    private snapshot() { this.history.push(JSON.parse(JSON.stringify({ vases: this.state.vases, remainingTime: this.state.remainingTime, score: this.state.score, eliminatedGroups: this.state.eliminatedGroups, combo: this.state.combo }))); if (this.history.length > 40)
        this.history.shift(); }
    private restore(s: TransferSnapshot) { Object.assign(this.state, JSON.parse(JSON.stringify(s)), { status: 'playing' }); }
    private result(accepted: boolean, eliminated: string[], message?: string): MoveResult { return { accepted, eliminated, won: this.state.status === 'won', message }; }
}
