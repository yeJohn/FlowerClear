import { PropType, TransferLevel } from '../domain/Types';
import { FLOWERS } from './FlowerData';

const CHAPTERS=[
    '晨光温室','蔷薇茶会','蓝调花房','暮色沙龙','鎏金花展','典藏花室',
    '晴空花园','月影露台','香草庭院','云端花廊','星光展厅','四季花境'
];

const props=(chapter:number):Record<PropType,number>=>({
    hint:2,
    hourglass:chapter>=1?1:0,
    magic:chapter>=2?1:0
});

// Level progression lives independently from flower art/configuration so that
// balancing vase count, locks, time and flower pools does not touch rendering.
export const LEVELS:TransferLevel[]=Array.from({length:60},(_,index)=>{
    const id=index+1,chapter=Math.floor(index/5),local=index%5;
    const typeCount=id===1?2:Math.min(10+Math.floor(id/2),FLOWERS.length);
    const groupCount=id===1?2:id+4;
    const timeLimit=Math.min(600,300+Math.ceil((id-1)/6)*30);
    const vaseCount=id===1?3:id<=5?7:id<=15?8:9;
    const lockedVases=id<11
        ?undefined
        :id<16
            ?[{index:7,type:'flowers' as const,required:6}]
            :[{index:7,type:'flowers' as const,required:9},{index:8,type:'video' as const}];
    return{
        id,chapter,title:`${CHAPTERS[chapter]} · ${local+1}`,
        seed:9137+id*3571+Math.floor(id/10)*97,
        timeLimit,vaseCount,groupCount,
        flowerTypes:FLOWERS.slice(0,typeCount).map(flower=>flower.id),
        starTime:[Math.round(timeLimit*.18),Math.round(timeLimit*.38)],
        props:props(chapter),lockedVases
    };
});
