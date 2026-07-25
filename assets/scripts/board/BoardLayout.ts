export interface BoardPoint{x:number;y:number;}

export function createVasePositions(count:number):BoardPoint[]{
    if(count===3)return Array.from({length:3},(_,index)=>({x:(index-1)*250,y:85}));
    if(count>=7)return Array.from({length:count},(_,index)=>({x:(index%3-1)*215,y:285-Math.floor(index/3)*285}));
    if(count<=6)return Array.from({length:count},(_,index)=>({x:-240+(index%3)*240,y:245-Math.floor(index/3)*350}));
    return[];
}

export function flowerVisualSlot(index:number,count:number){
    return count<=1?1:count===2?[0,2][index]:index;
}
