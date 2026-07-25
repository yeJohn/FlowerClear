import { FlowerConfig } from '../domain/Types';

export const FLOWERS:FlowerConfig[]=[
    ['rose','玫瑰'],['sunflower','向日葵'],['tulip','郁金香'],['camellia','山茶'],['peony','牡丹'],
    ['ranunculus','花毛茛'],['hibiscus','木槿'],['hydrangea','绣球'],['iris','鸢尾'],['freesia','小苍兰'],
    ['carnation','康乃馨'],['cherry','樱花'],['daisy','雏菊'],['lily','百合'],['anemone','银莲花'],
    ['snapdragon','金鱼草'],['dahlia','大丽花'],['gerbera','非洲菊'],['delphinium','飞燕草'],['zinnia','百日菊']
].map(([id,name])=>({id,name,assetKey:`art/flowers/${id}/texture`}));

export const FLOWER_BY_ID=FLOWERS.reduce<Record<string,FlowerConfig>>((map,flower)=>{
    map[flower.id]=flower;
    return map;
},{});
