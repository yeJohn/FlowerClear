import{FlowerConfig,PropType,TransferLevel}from'../domain/Types';
export const FLOWERS:FlowerConfig[]=[
['rose','玫瑰'],['sunflower','向日葵'],['tulip','郁金香'],['camellia','山茶'],['peony','牡丹'],['ranunculus','花毛茛'],['hibiscus','木槿'],['hydrangea','绣球'],['iris','鸢尾'],['freesia','小苍兰'],['carnation','康乃馨'],['cherry','樱花'],['daisy','雏菊'],['lily','百合'],['anemone','银莲花'],['snapdragon','金鱼草'],['dahlia','大丽花'],['gerbera','非洲菊'],['delphinium','飞燕草'],['zinnia','百日菊']
].map(([id,name])=>({id,name,assetKey:`art/flowers/${id}/texture`}));
export const FLOWER_BY_ID=FLOWERS.reduce<Record<string,FlowerConfig>>((m,f)=>{m[f.id]=f;return m;},{});
const chapters=['晨光温室','蔷薇茶会','蓝调花房','暮色沙龙','鎏金花展','典藏花室','晴空花园','月影露台','香草庭院','云端花廊','星光展厅','四季花境'];
const props=(chapter:number):Record<PropType,number>=>({hint:2,hourglass:chapter>=1?1:0,magic:chapter>=2?1:0});
export const LEVELS:TransferLevel[]=Array.from({length:60},(_,i)=>{const id=i+1,chapter=Math.floor(i/5),local=i%5,typeCount=id===1?2:Math.min(10+Math.floor(id/2),FLOWERS.length),groupCount=id===1?2:id+4,timeLimit=Math.min(600,300+Math.ceil((id-1)/6)*30),vaseCount=id===1?3:id<=5?7:id<=15?8:9,lockedVases=id<11?undefined:id<16?[{index:7,type:'flowers' as const,required:6}]:[{index:7,type:'flowers' as const,required:9},{index:8,type:'video' as const}];return{id,chapter,title:`${chapters[chapter]} · ${local+1}`,seed:9137+id*3571+Math.floor(id/10)*97,timeLimit,vaseCount,groupCount,flowerTypes:FLOWERS.slice(0,typeCount).map(f=>f.id),starTime:[Math.round(timeLimit*.18),Math.round(timeLimit*.38)],props:props(chapter),lockedVases};});
