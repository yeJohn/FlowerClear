declare const wx: undefined | {
  vibrateShort?: (options?: object) => void;
  showShareMenu?: (options?: {withShareTicket?:boolean;menus?:Array<'shareAppMessage'|'shareTimeline'>;success?:()=>void;fail?:(error:unknown)=>void}) => void;
  onShareAppMessage?: (listener:()=>SharePayload) => void;
  onShareTimeline?: (listener:()=>SharePayload) => void;
  shareAppMessage?: (options:SharePayload) => void;
};

type SharePayload={title:string;query?:string;imageUrl?:string;};
const SHARE_TITLE='秘境花瓶：把花朵送回最合适的花瓶';

export class PlatformService {
  static isWechat() { return typeof wx !== 'undefined'; }
  static vibrate() { if (this.isWechat()) wx?.vibrateShort?.({ type: 'light' }); }
  static initializeSharing(){
    if(!this.isWechat())return;
    const payload=()=>({title:SHARE_TITLE,query:'from=share'});
    wx?.showShareMenu?.({withShareTicket:true,menus:['shareAppMessage','shareTimeline']});
    wx?.onShareAppMessage?.(payload);
    wx?.onShareTimeline?.(()=>({title:SHARE_TITLE,query:'from=timeline'}));
  }
  static shareToFriend(){
    if(!this.isWechat())return false;
    wx?.shareAppMessage?.({title:SHARE_TITLE,query:'from=friend'});
    return true;
  }
  static openTimelineShare(){
    if(!this.isWechat())return false;
    wx?.showShareMenu?.({withShareTicket:true,menus:['shareAppMessage','shareTimeline']});
    return true;
  }
}
