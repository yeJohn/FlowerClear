import { ImageAsset, resources } from 'cc';

declare const wx: undefined | {
  vibrateShort?: (options?: object) => void;
  showShareMenu?: (options?: {withShareTicket?:boolean;menus?:Array<'shareAppMessage'|'shareTimeline'>;success?:()=>void;fail?:(error:unknown)=>void}) => void;
  onShareAppMessage?: (listener:()=>SharePayload) => void;
  onShareTimeline?: (listener:()=>SharePayload) => void;
  shareAppMessage?: (options:SharePayload) => void;
};

type SharePayload={title:string;query?:string;imageUrl?:string;};
const SHARE_TITLE='把花朵移到最合适的花瓶中';

export class PlatformService {
  private static shareImageUrl='';
  private static payload(query:string):SharePayload{
    return{title:SHARE_TITLE,query,...(this.shareImageUrl?{imageUrl:this.shareImageUrl}:{})};
  }
  static isWechat() { return typeof wx !== 'undefined'; }
  static vibrate() { if (this.isWechat()) wx?.vibrateShort?.({ type: 'light' }); }
  static initializeSharing(){
    if(!this.isWechat())return;
    resources.load('art/ui/share_friend_cover',ImageAsset,(error,image)=>{
      const imageUrl=image?.nativeUrl;
      if(!error&&imageUrl)this.shareImageUrl=imageUrl;
      else console.error('分享封面加载失败',error);
    });
    const payload=()=>this.payload('from=share');
    wx?.showShareMenu?.({withShareTicket:true,menus:['shareAppMessage','shareTimeline']});
    wx?.onShareAppMessage?.(payload);
    wx?.onShareTimeline?.(()=>this.payload('from=timeline'));
  }
  static shareToFriend(){
    if(!this.isWechat())return false;
    wx?.shareAppMessage?.(this.payload('from=friend'));
    return true;
  }
  static openTimelineShare(){
    if(!this.isWechat())return false;
    wx?.showShareMenu?.({withShareTicket:true,menus:['shareAppMessage','shareTimeline']});
    return true;
  }
}
