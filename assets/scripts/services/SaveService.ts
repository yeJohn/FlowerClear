import{PlayerSave,PropType}from'../domain/Types';
declare const wx:undefined|{getStorageSync?:(key:string)=>unknown;setStorageSync?:(key:string,value:unknown)=>void};
const KEY='flower_vase_transfer_save_v3';
const props=():Record<PropType,number>=>({hint:0,hourglass:2,magic:1});
const fresh=():PlayerSave=>({version:4,unlockedLevel:1,levelStars:{},bestScores:{},coins:0,videoUnlockedLevels:{},props:props(),music:true,sfx:true,vibration:true,tutorialStep:0,checkIn:{claimedDays:0,lastClaimDate:''}});
export const DAILY_REWARDS=[20,30,40,50,60,80,120] as const;
export const PROP_PRICES:Record<PropType,number>={hourglass:60,magic:150,hint:80};

export class SaveService{
    static load(){
        try{
            const raw=typeof wx!=='undefined'?wx.getStorageSync?.(KEY):localStorage.getItem(KEY),p=typeof raw==='string'?JSON.parse(raw):raw||{},old=p as Partial<PlayerSave>;
            return{...fresh(),...old,version:4,coins:Number(old.coins)||0,videoUnlockedLevels:{...(old.videoUnlockedLevels||{})},props:{...props(),...old.props},checkIn:{...fresh().checkIn,...old.checkIn}}as PlayerSave;
        }catch{return fresh();}
    }
    static write(s:PlayerSave){if(typeof wx!=='undefined')wx.setStorageSync?.(KEY,s);else localStorage.setItem(KEY,JSON.stringify(s));}
    static localDate(date=new Date()){const two=(value:number)=>value<10?`0${value}`:String(value),y=date.getFullYear(),m=two(date.getMonth()+1),d=two(date.getDate());return`${y}-${m}-${d}`;}
    static canCheckIn(s=this.load()){return s.checkIn.lastClaimDate!==this.localDate();}
    static claimDailyReward(multiplier=1){
        const s=this.load(),today=this.localDate();
        if(s.checkIn.lastClaimDate===today)return{ok:false,day:s.checkIn.claimedDays||1,reward:0,save:s};
        const day=s.checkIn.claimedDays>=7?1:s.checkIn.claimedDays+1,reward=DAILY_REWARDS[day-1]*(multiplier===2?2:1);
        s.checkIn={claimedDays:day,lastClaimDate:today};s.coins+=reward;this.write(s);
        return{ok:true,day,reward,save:s};
    }
    static totalStars(s=this.load()){return Object.keys(s.levelStars).reduce((sum:number,key:string)=>sum+(s.levelStars[key]||0),0);}
    static requiredStars(id:number){if(id<=1)return 0;const steps=[2,2,2,3,2,2,3,2,3,2],count=id-1,cycles=Math.floor(count/steps.length),rest=count%steps.length;return cycles*steps.reduce((a,b)=>a+b,0)+steps.slice(0,rest).reduce((a,b)=>a+b,0);}
    static setProps(inventory:Record<PropType,number>){const s=this.load();s.props={...props(),...inventory};this.write(s);}
    static buyProp(prop:PropType){
        const s=this.load(),price=PROP_PRICES[prop];
        if(s.coins<price)return{ok:false,price,save:s};
        s.coins-=price;s.props[prop]=(s.props[prop]||0)+1;this.write(s);
        return{ok:true,price,save:s};
    }
    static addCoins(amount:number){const s=this.load();s.coins+=Math.max(0,Math.floor(amount));this.write(s);return s;}
    static setAudio(kind:'music'|'sfx',enabled:boolean){const s=this.load();s[kind]=enabled;this.write(s);}
    static unlockByVideo(id:number){const s=this.load();s.videoUnlockedLevels[String(id)]=true;this.write(s);}
    static markTutorialDone(){const s=this.load();s.tutorialStep=1;this.write(s);}
    static complete(id:number,stars:number,score=0){const s=this.load(),k=String(id);s.levelStars[k]=Math.max(s.levelStars[k]??0,stars);s.bestScores[k]=Math.max(s.bestScores[k]??0,score);s.unlockedLevel=Math.min(60,Math.max(s.unlockedLevel,id+1));this.write(s);}
}
