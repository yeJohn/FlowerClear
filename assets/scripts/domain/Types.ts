export type PropType='hint'|'hourglass'|'magic';
export type GameStatus='loading'|'playing'|'won'|'failed'|'paused';
export interface FlowerConfig{id:string;name:string;assetKey:string;}
export interface VaseLock{type:'flowers'|'video';required:number;unlocked:boolean;}
export interface VaseStack{id:string;skinId:string;layers:string[][];lock?:VaseLock;}
export interface TransferLevel{id:number;chapter:number;title:string;seed:number;timeLimit:number;vaseCount:number;groupCount:number;flowerTypes:string[];starTime:[number,number];props:Record<PropType,number>;lockedVases?:Array<{index:number;type:'flowers'|'video';required?:number}>;}
export interface TransferSnapshot{vases:VaseStack[];remainingTime:number;score:number;eliminatedGroups:number;combo:number;}
export interface TransferState extends TransferSnapshot{levelId:number;status:GameStatus;moves:number;lastEliminateAt:number;}
export interface MoveResult{accepted:boolean;eliminated:string[];won:boolean;message?:string;}
export interface LevelResult{stars:1|2|3;score:number;remainingTime:number;coins:number;}
export interface PlayerSave{version:3;unlockedLevel:number;levelStars:Record<string,number>;bestScores:Record<string,number>;coins:number;videoUnlockedLevels:Record<string,boolean>;props:Record<PropType,number>;music:boolean;sfx:boolean;vibration:boolean;tutorialStep:number;}
