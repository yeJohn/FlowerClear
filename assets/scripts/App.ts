import { _decorator, BlockInputEvents, Button, Color, Component, EventTouch, game, Graphics, HorizontalTextAlignment, Input, input, Label, Node, Rect, ResolutionPolicy, resources, Size, Sprite, SpriteFrame, Texture2D, tween, UIOpacity, UITransform, Vec2, Vec3, VerticalTextAlignment, view } from 'cc';
import { FLOWER_BY_ID, LEVELS } from './config/GameData';
import { ArrangementModel } from './domain/ArrangementModel';
import { LevelResult, PropType } from './domain/Types';
import { ConfigValidator } from './debug/ConfigValidator';
import { DAILY_REWARDS, PROP_PRICES, SaveService } from './services/SaveService';
import { PlatformService } from './services/PlatformService';
import { AudioService } from './services/AudioService';
import { createVasePositions, flowerVisualSlot } from './board/BoardLayout';
const { ccclass } = _decorator;
const C = { ink: new Color('#344840'), sage: new Color('#73A08D'), parchment: new Color('#F7F8F2'), paper: new Color('#FFFFFF'), gold: new Color('#E8AE61'), rose: new Color('#EF7890'), glass: new Color(55, 77, 68, 210), white: Color.WHITE };
const PROP: Record<PropType, [string, string]> = { hourglass: ['prop_time', '加时'], magic: ['prop_magic', '随机消除'], hint: ['prop_shuffle', '打乱'] };
const PROP_DESCRIPTION:Record<PropType,string>={hourglass:'增加 60 秒整理时间',magic:'消除一组三朵同款花',hint:'重新排列当前所有花朵'};
const BUTTON_KEYS=['button_start','button_video_unlock','button_collect_stars','button_continue','button_level_select','button_restart','button_shuffle','button_next','button_revive','button_collection','button_replay'];
type ActiveFlowerDrag={
    sourceId:string;slotIndex:number;node:Node;sprite:Sprite;originalColor:Color;
    proxy:Node;proxyStart:Vec3;moved:boolean;touchId:number|null;lastUi:Vec2;
};
type FlowerDragSource={touchNode:Node;flowerNode:Node;sourceId:string;slotIndex:number;};
@ccclass('FlowerGameApp')
export class FlowerGameApp extends Component {
    private root!: Node;
    private model: ArrangementModel | null = null;
    private sprites = new Map<string, SpriteFrame>();
    private vaseArea: Node | null = null;
    private vaseTargets = new Map<string, Node>();
    private vaseVisualSlots = new Map<string, number[]>();
    private timeLabel: Label | null = null;
    private progressLabel: Label | null = null;
    private propArea: Node | null = null;
    private hint: {
        sourceId: string;
        slotIndex: number;
        targetId: string;
    } | null = null;
    private modal = false;
    private levelPage = 0;
    private loadingLabel: Label|null = null;
    private loadingBar: Graphics|null = null;
    private tutorialStep = -1;
    private deadlockCheckToken = 0;
    private draggingFlower=false;
    private timerStarted=false;
    private lastHudSecond=-1;
    private lastHudRemaining=-1;
    private activeDrag:ActiveFlowerDrag|null=null;
    private selectedFlower:{sourceId:string;slotIndex:number}|null=null;
    private dragSources:FlowerDragSource[]=[];
    override start() { view.setDesignResolutionSize(750, 1334, ResolutionPolicy.FIXED_WIDTH);if(typeof document!=='undefined'){const doc:any=document;if(doc.documentElement?.style)doc.documentElement.style.touchAction='none';if(doc.body?.style){doc.body.style.touchAction='none';doc.body.style.overscrollBehavior='none';}const canvas=doc.querySelector?.('canvas');if(canvas?.style)canvas.style.touchAction='none';}input.on(Input.EventType.TOUCH_START,this.onBoardTouchStart,this);input.on(Input.EventType.TOUCH_MOVE,this.onBoardTouchMove,this);input.on(Input.EventType.TOUCH_END,this.onBoardTouchEnd,this);input.on(Input.EventType.TOUCH_CANCEL,this.onBoardTouchEnd,this); AudioService.initialize(this.node);PlatformService.initializeSharing();this.root = new Node('AppRoot');const visible=view.getVisibleSize();this.root.addComponent(UITransform).setContentSize(Math.max(750,visible.width),Math.max(1334,visible.height)); this.node.addChild(this.root);this.showLoading(); const errors = ConfigValidator.validate(); if (errors.length)
        console.error(errors.join('\n'));this.loadArtAssets(progress=>this.updateLoading(progress)).then(() => {this.updateLoading(1);this.scheduleOnce(()=>{AudioService.ensureMusic();this.showHome();},.06);}); }
    override onDestroy(){this.cancelActiveDrag();input.off(Input.EventType.TOUCH_START,this.onBoardTouchStart,this);input.off(Input.EventType.TOUCH_MOVE,this.onBoardTouchMove,this);input.off(Input.EventType.TOUCH_END,this.onBoardTouchEnd,this);input.off(Input.EventType.TOUCH_CANCEL,this.onBoardTouchEnd,this);this.unscheduleAllCallbacks();}
    private async loadArtAssets(onProgress:(progress:number)=>void,only?:Set<string>) { const entries: {
        key: string;
        path: string;
    }[] = [...Object.keys(FLOWER_BY_ID).map(key => ({ key, path: `art/flowers/${key}/texture` })), ...Array.from({ length: 6 }, (_, i) => ({ key: `vase_${i + 1}`, path: `art/vases/modern_vase_${i + 1}/texture` })), ...Array.from({ length: 6 }, (_, i) => ({ key: `vase_front_${i + 1}`, path: `art/vases/modern_vase_front_${i + 1}/texture` })), ...Array.from({ length: 6 }, (_, i) => ({ key: `vase_inner_${i + 1}`, path: `art/vases/vase_inner_${i + 1}/texture` })), ...Array.from({ length: 6 }, (_, i) => ({ key: `vase_opaque_${i + 1}`, path: `art/vases/vase_opaque_${i + 1}/texture` })), ...['button_primary','panel_popup','prop_time','prop_magic','prop_shuffle','lock_count','lock_video','button_circle','ui_back','ui_pause','ui_settings','star_filled','tutorial_finger','home_checkin','home_share_friend','home_share_timeline',...BUTTON_KEYS].map(key=>({key,path:`art/ui/${key}/texture`})), { key: 'conservatory', path: 'art/backgrounds/conservatory_clean/texture' }],selected=entries.filter(entry=>!this.sprites.has(entry.key)&&(!only||only.has(entry.key)));if(!selected.length){onProgress(1);return;}let loaded=0; await Promise.all(selected.map(entry => new Promise<void>(resolve => { resources.load(entry.path, Texture2D, (error, texture) => { if (error || !texture)
        console.error(`美术纹理加载失败：${entry.path}`, error);
    else {
        texture.setFilters(Texture2D.Filter.LINEAR,Texture2D.Filter.LINEAR);
        texture.setMipFilter(Texture2D.Filter.LINEAR);
        texture.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE,Texture2D.WrapMode.CLAMP_TO_EDGE);
        texture.setAnisotropy(4);
        const width = texture.width, height = texture.height, frame = new SpriteFrame();
        frame.reset({ texture, rect: new Rect(0, 0, width, height), originalSize: new Size(width, height), offset: new Vec2(0, 0), isRotate: false });
        frame.name = entry.key;
        this.sprites.set(entry.key, frame);
    } loaded++;onProgress(loaded/selected.length);resolve(); }); }))); console.log(`美术纹理加载完成：${this.sprites.size}/${entries.length}`); if (!only&&this.sprites.size !== entries.length)
        console.error(`美术纹理不完整：${this.sprites.size}/${entries.length}`); }
    override update(dt: number) { if (!this.model || this.modal)
        return; if(this.timerStarted)this.model.tick(dt); this.refreshHud(); if (this.model.state.status === 'failed')
        this.showFail(); }
    private showLoading(){this.root.removeAllChildren();const visible=view.getVisibleSize(),bg=this.panel(this.root,'LoadingBackground',0,0,Math.max(750,visible.width),Math.max(1334,visible.height),new Color('#F6F1E5'),0);this.text(bg,'花香正在抵达…',0,-215,23,C.sage);this.panel(bg,'LoadingTrack',0,-270,480,28,new Color(219,224,208,255),14);const fill=new Node('LoadingFill');fill.setPosition(-230,-270);fill.addComponent(UITransform).setContentSize(460,22);this.loadingBar=fill.addComponent(Graphics);bg.addChild(fill);this.loadingLabel=this.text(bg,'0%',0,-320,20,C.ink,180);this.updateLoading(0);}
    private updateLoading(progress:number){const p=Math.max(0,Math.min(1,progress));if(this.loadingLabel)this.loadingLabel.string=`${Math.round(p*100)}%`;if(this.loadingBar){this.loadingBar.clear();this.loadingBar.fillColor=C.sage;this.loadingBar.roundRect(0,-11,460*p,22,11);this.loadingBar.fill();}}
    private clear() { this.unscheduleAllCallbacks();this.cancelActiveDrag();this.selectedFlower=null;this.dragSources.length=0;this.deadlockCheckToken++;this.draggingFlower=false;this.timerStarted=false;this.lastHudSecond=-1;this.lastHudRemaining=-1;this.root.removeAllChildren(); this.model = null; this.vaseArea = null; this.propArea = null; this.vaseTargets.clear();this.vaseVisualSlots.clear(); this.timeLabel = null; this.progressLabel = null;this.loadingLabel=null;this.loadingBar=null;this.tutorialStep=-1; this.hint = null; this.modal = false; }
    private panel(p: Node, name: string, x: number, y: number, w: number, h: number, color: Color, r = 20) { const n = new Node(name); n.setPosition(x, y); n.addComponent(UITransform).setContentSize(w, h); const g = n.addComponent(Graphics); g.fillColor = color; g.roundRect(-w / 2, -h / 2, w, h, r); g.fill(); p.addChild(n); return n; }
    private fullPanel(p:Node,name:string,color:Color){const visible=view.getVisibleSize();return this.panel(p,name,0,0,Math.max(750,visible.width),Math.max(1334,visible.height),color,0);}
    private modalPanel(p:Node,name:string,color:Color){const n=this.fullPanel(p,name,color);n.addComponent(BlockInputEvents);return n;}
    private text(p: Node, s: string, x: number, y: number, size = 26, color = C.ink, w = 650) { const fs=Math.round(size*1.3),n=new Node('Text'); n.setPosition(x, y); n.addComponent(UITransform).setContentSize(w, fs * 2.4); const l = n.addComponent(Label); l.string = s; l.fontSize = fs; l.lineHeight = fs * 1.25; l.color = color; l.horizontalAlign = HorizontalTextAlignment.CENTER; l.verticalAlign = VerticalTextAlignment.CENTER; l.overflow = Label.Overflow.SHRINK; p.addChild(n); return l; }
    private paragraph(p: Node, s: string, x: number, y: number, w: number, h: number, size = 24, color = C.ink) { const fs=Math.round(size*1.16),n=new Node('Paragraph'); n.setPosition(x, y); n.addComponent(UITransform).setContentSize(w, h); const l = n.addComponent(Label); l.string = s; l.fontSize = fs; l.lineHeight = fs * 1.6; l.color = color; l.horizontalAlign = HorizontalTextAlignment.LEFT; l.verticalAlign = VerticalTextAlignment.CENTER; l.overflow = Label.Overflow.SHRINK; p.addChild(n); return l; }
    private artStretch(p:Node,key:string,x:number,y:number,w:number,h:number){const n=new Node('Art_'+key);n.setPosition(x,y);n.addComponent(UITransform).setContentSize(w,h);const s=n.addComponent(Sprite);s.sizeMode=Sprite.SizeMode.CUSTOM;s.spriteFrame=this.sprites.get(key)||null;p.addChild(n);return n;}
    private artCover(p:Node,key:string,x:number,y:number,w:number,h:number){const sf=this.sprites.get(key),n=new Node('Art_'+key);n.setPosition(x,y);let drawW=w,drawH=h;if(sf){const size=sf.originalSize,scale=Math.max(w/size.width,h/size.height);drawW=Math.ceil(size.width*scale);drawH=Math.ceil(size.height*scale);}n.addComponent(UITransform).setContentSize(drawW,drawH);const s=n.addComponent(Sprite);s.sizeMode=Sprite.SizeMode.CUSTOM;s.spriteFrame=sf||null;p.addChild(n);return n;}
    private artPanel(p:Node,name:string,x:number,y:number,w:number,h:number){const n=this.art(p,'panel_popup',x,y,Math.round(w*1.08),Math.round(h*1.08));n.name=name;return n;}
    private button(p: Node, s: string, x: number, y: number, w: number, h: number, fn: () => void, enabled = true, color = C.sage) {const scale=1.08,drawW=Math.round(w*scale),circle=w===h,key=circle?'button_circle':'button_primary',drawH=circle?Math.round(h*scale):Math.round(drawW/3.95),n=circle?this.art(p,key,x,y,drawW,drawH):this.artStretch(p,key,x,y,drawW,drawH);n.name='Button_'+s;n.getComponent(Sprite)!.color=enabled?Color.WHITE:new Color('#9E9D95');n.addComponent(Button).interactable=enabled;this.text(n,s,0,0,22,enabled?C.ink:new Color('#747A76'),drawW-72);n.on(Button.EventType.CLICK,()=>{AudioService.playButton();fn();},this);return n; }
    private videoButton(p:Node,s:string,x:number,y:number,w:number,h:number,fn:()=>void){const drawW=Math.round(w*1.08),drawH=Math.round(drawW/3.95),n=this.artStretch(p,'button_primary',x,y,drawW,drawH);n.name='Button_'+s;n.addComponent(Button);n.on(Button.EventType.CLICK,()=>{AudioService.playButton();this.logVideoClick(s);fn();},this);this.art(n,'lock_video',-drawW*.3,0,40,40);this.text(n,s,drawW*.08,0,22,C.ink,drawW*.62);return n;}
    private logVideoClick(action:string,extra:Record<string,unknown>={}){
        console.log('[激励视频占位] 点击视频入口',{action,...extra});
        game.resume();
        AudioService.syncSettings();
        AudioService.ensureMusic();
    }
    private artButton(p:Node,key:string,x:number,y:number,size:number,fn:()=>void){const drawSize=Math.round(size*1.12),n=this.art(p,key,x,y,drawSize,drawSize);n.addComponent(Button);n.on(Button.EventType.CLICK,()=>{AudioService.playButton();fn();},this);return n;}
    private art(p: Node, key: string, x: number, y: number, maxW: number, maxH: number) { const sf = this.sprites.get(key), n = new Node('Art_' + key); n.setPosition(x, y); const t = n.addComponent(UITransform); let w = maxW, h = maxH; if (sf) {
        const sz = sf.originalSize, scale = Math.min(maxW / sz.width, maxH / sz.height);
        w = Math.round(sz.width * scale);
        h = Math.round(sz.height * scale);
    } t.setContentSize(w, h); const s = n.addComponent(Sprite); s.sizeMode = Sprite.SizeMode.CUSTOM; s.spriteFrame = sf || null; p.addChild(n); return n; }
    private background() { const visible=view.getVisibleSize(),w=Math.max(750,visible.width),h=Math.max(1334,visible.height),n=this.artCover(this.root,'conservatory',0,0,w,h); n.setSiblingIndex(0); const tone=this.panel(this.root,'BackgroundTone',0,0,w,h,new Color(57,82,67,48),0);tone.setSiblingIndex(1); }
    private showHome(checkToday=true) { this.clear(); this.background();const homeSave=SaveService.load(),showCoins=()=>this.showCoinReward(),coinButton=this.button(this.root,`✦ ${homeSave.coins}`,-245,545,205,58,showCoins,true,C.gold),coinLabel=coinButton.getChildByName('Text');if(coinLabel)coinLabel.setPosition(-22,0);const addArea=this.panel(coinButton,'CoinAdd',78,0,44,44,C.gold,22);this.text(addArea,'+',0,1,25,C.white,38);this.artButton(this.root,'ui_settings',280,545,72,()=>this.showSettings());const display=new Node('HomeVase');display.setPosition(0,145);display.setScale(1.23,1.23,1);display.addComponent(UITransform).setContentSize(218,300);this.root.addChild(display);const inner=this.art(display,'vase_inner_2',0,-62,145,165);inner.setSiblingIndex(0);const left=this.art(display,'rose',this.flowerSlotX('rose',0)+this.flowerCenterCorrection('rose'),30,115,225);left.setRotationFromEuler(0,0,this.flowerSlotRotation('rose',0));const middle=this.art(display,'tulip',this.flowerCenterCorrection('tulip'),44,115,225);const right=this.art(display,'daisy',this.flowerSlotX('daisy',2)+this.flowerCenterCorrection('daisy'),30,115,225);right.setRotationFromEuler(0,0,this.flowerSlotRotation('daisy',2));left.setSiblingIndex(4);middle.setSiblingIndex(6);right.setSiblingIndex(5);const body=this.art(display,'vase_opaque_2',0,-62,145,165);body.setSiblingIndex(45);const front=this.art(display,'vase_front_2',0,-62,145,165);front.setSiblingIndex(50);const startButton=this.button(this.root, '开始整理', 0, -235, 340, 76, () => {AudioService.ensureMusic();this.showLevels();}, true, C.rose),startLabel=startButton.getChildByName('Text')?.getComponent(Label);if(startLabel){startLabel.fontSize=31;startLabel.lineHeight=38;} const save = homeSave; this.text(this.root, `已收集 ${SaveService.totalStars(save)} 颗星`, 0, -305, 23, C.ink);this.homeActionButton('home_checkin','签到',-220,-440,()=>this.showCheckIn());this.homeActionButton('home_share_friend','转发好友',0,-440,()=>this.shareFriend());this.homeActionButton('prop_magic','商城',220,-440,()=>this.showStore());if(checkToday&&SaveService.canCheckIn(save))this.scheduleOnce(()=>{if(!this.modal&&SaveService.canCheckIn())this.showCheckIn();},.08); }
    private homeActionButton(icon:string,label:string,x:number,y:number,action:()=>void){const n=this.art(this.root,'button_circle',x,y,144,144);n.name='HomeAction_'+label;n.addComponent(Button);n.on(Button.EventType.CLICK,()=>{AudioService.playButton();action();},this);this.art(n,icon,0,9,84,84);const tag=this.panel(n,'ActionLabel',0,-55,132,40,new Color(52,72,64,242),20);this.text(tag,label,0,0,18,C.white,122);return n;}
    private showCheckIn(){
        if(this.modal)return;
        this.modal=true;
        const overlay=this.modalPanel(this.root,'CheckIn',new Color(24,34,29,195)),card=this.artPanel(overlay,'Card',0,0,650,860);
        this.text(card,'七日花礼',0,320,40,C.ink);
        this.text(card,'每天来花园领取一份花币',0,265,20,C.sage);
        let doubleReward=false,lastToggleAt=0,claiming=false;
        const renderDays=()=>{
            const old=card.getChildByName('CheckInDays');if(old)old.destroy();
            const area=new Node('CheckInDays');area.name='CheckInDays';area.addComponent(UITransform).setContentSize(590,370);area.setPosition(0,35);card.addChild(area);
            const save=SaveService.load(),claimed=save.checkIn.claimedDays,canClaim=SaveService.canCheckIn(save),next=claimed>=7?1:claimed+1;
            DAILY_REWARDS.forEach((reward,index)=>{
                const day=index+1,row=index<4?0:1,col=index<4?index:index-4,count=row===0?4:3,x=(col-(count-1)/2)*137,y=row===0?92:-80,isClaimed=claimed>=day&&!(claimed===7&&canClaim),isNext=canClaim&&day===next;
                const tile=this.panel(area,`Day_${day}`,x,y,118,145,isNext?new Color(255,246,215,252):new Color(244,247,238,245),22),g=tile.getComponent(Graphics)!;
                g.strokeColor=isNext?C.gold:C.sage;g.lineWidth=isNext?4:2;g.roundRect(-59,-72.5,118,145,22);g.stroke();
                this.text(tile,`第${day}天`,0,42,17,C.ink,100);this.text(tile,`✦ ${reward}`,0,-4,22,isClaimed?new Color('#9AA29C'):C.gold,100);this.text(tile,isClaimed?'已领取':isNext?'可领取':'待解锁',0,-47,15,isNext?C.rose:C.sage,100);
            });
        };
        const claimArea=new Node('CheckInClaimArea');claimArea.addComponent(UITransform).setContentSize(430,90);claimArea.setPosition(0,-250);card.addChild(claimArea);
        const finishClaim=()=>{
            if(claiming)return;claiming=true;
            const multiplier=doubleReward?2:1;
            if(doubleReward)this.logVideoClick('签到双倍奖励',{multiplier});
            const result=SaveService.claimDailyReward(multiplier);
            if(!result.ok){this.toast('今天已经签到啦');claiming=false;return;}
            this.toast(`第 ${result.day} 天签到成功，获得 ${result.reward} 花币`);
            renderDays();renderOption();renderClaim();
        };
        const renderClaim=()=>{
            claimArea.removeAllChildren();
            const canClaim=SaveService.canCheckIn();
            if(!canClaim){this.button(claimArea,'今日已签到',0,0,310,72,()=>{},false);return;}
            if(doubleReward)this.videoButton(claimArea,'看视频领双倍',0,0,340,76,finishClaim);
            else this.button(claimArea,'签到',0,0,310,72,finishClaim,true,C.rose);
        };
        const optionArea=new Node('DoubleRewardOption');optionArea.addComponent(UITransform).setContentSize(430,58);optionArea.setPosition(0,-180);card.addChild(optionArea);const optionButton=optionArea.addComponent(Button);
        const renderOption=()=>{
            optionArea.removeAllChildren();
            const enabled=SaveService.canCheckIn()&&!claiming,box=this.panel(optionArea,'Checkbox',-170,0,44,44,doubleReward?new Color(237,178,93,255):new Color(255,252,244,255),10),g=box.getComponent(Graphics)!;
            g.strokeColor=doubleReward?C.gold:C.sage;g.lineWidth=3;g.roundRect(-22,-22,44,44,10);g.stroke();
            if(doubleReward)this.text(box,'✓',0,1,25,C.white,38);
            const rewardLabel=this.text(optionArea,'看视频，领取双倍奖励',40,0,20,enabled?C.ink:new Color('#949B96'),340);
            rewardLabel.horizontalAlign=HorizontalTextAlignment.LEFT;
            optionButton.interactable=enabled;
        };
        optionArea.on(Button.EventType.CLICK,()=>{
            const now=Date.now();if(claiming||now-lastToggleAt<500)return;
            lastToggleAt=now;doubleReward=!doubleReward;AudioService.playButton();renderOption();renderClaim();
        },this);
        renderDays();renderOption();renderClaim();
        this.button(card,'关闭',0,-355,310,72,()=>{overlay.destroy();this.modal=false;this.showHome(false);});
    }
    private showCoinReward(){
        if(this.modal)return;
        this.modal=true;
        const overlay=this.modalPanel(this.root,'CoinReward',new Color(24,34,29,195)),card=this.artPanel(overlay,'Card',0,0,590,620);
        this.text(card,'花币补给',0,240,40,C.ink);
        this.text(card,'观看视频，为花园补充花币',0,140,23,C.sage,480);
        const balance=this.text(card,`当前花币  ✦ ${SaveService.load().coins}`,0,50,29,C.gold,440);
        this.videoButton(card,'看视频得 20 花币',0,-90,390,72,()=>{
            const save=SaveService.addCoins(20);
            balance.string=`当前花币  ✦ ${save.coins}`;
            this.toast('获得 20 花币');
        });
        this.button(card,'关闭',0,-220,310,72,()=>{overlay.destroy();this.modal=false;this.showHome(false);});
    }
    private showStore(){
        if(this.modal)return;
        this.modal=true;
        const overlay=this.modalPanel(this.root,'Store',new Color(24,34,29,195)),card=this.artPanel(overlay,'Card',0,0,650,900);
        this.text(card,'商店',0,355,40,C.ink);
        const content=new Node('StoreContent');content.addComponent(UITransform).setContentSize(590,640);content.setPosition(0,-5);card.addChild(content);
        const render=()=>{
            content.removeAllChildren();
            const save=SaveService.load();
            this.text(content,`现有花币  ✦ ${save.coins}`,0,285,24,C.gold,420);
            (['hourglass','magic','hint'] as PropType[]).forEach((prop,index)=>{
                const [icon,name]=PROP[prop],item=this.panel(content,`Store_${prop}`,0,145-index*170,555,145,new Color(247,249,241,248),26),g=item.getComponent(Graphics)!;
                g.strokeColor=new Color(115,160,141,130);g.lineWidth=2;g.roundRect(-277.5,-72.5,555,145,26);g.stroke();
                this.art(item,icon,-215,5,prop==='hourglass'?120:100,prop==='hourglass'?120:100);
                const nameLabel=this.text(item,name,-30,30,26,C.ink,220);nameLabel.horizontalAlign=HorizontalTextAlignment.LEFT;
                const desc=this.text(item,PROP_DESCRIPTION[prop],-30,-21,18,C.sage,220);desc.horizontalAlign=HorizontalTextAlignment.LEFT;
                this.text(item,`持有 ${save.props[prop]||0}`,190,43,18,C.sage,130);
                this.button(item,`✦ ${PROP_PRICES[prop]}`,190,-29,155,60,()=>{
                    const result=SaveService.buyProp(prop);
                    if(!result.ok){this.toast('花币不足');return;}
                    this.toast(`已购买 1 次${name}`);
                    render();
                },true,C.rose);
            });
        };
        render();
        this.button(card,'关闭',0,-365,310,72,()=>{overlay.destroy();this.modal=false;this.showHome(false);});
    }
    private shareFriend(){if(PlatformService.shareToFriend())this.toast('已打开好友转发');else this.toast('请在微信小游戏中转发给好友');}
    private showLevels(page=this.levelPage) { this.levelPage=Math.max(0,Math.min(1,page));this.clear(); this.background(); this.fullPanel(this.root,'Veil',new Color(248,244,232,225)); this.text(this.root, '花语之旅', 0, 585, 42, C.ink); this.artButton(this.root,'ui_back',-310,585,64,()=>this.showHome(false)); const s=SaveService.load(),total=SaveService.totalStars(s);this.text(this.root,`已收集 ${total} 颗星`,0,535,21,C.sage);for(let i=0;i<30;i++){
        const id=this.levelPage*30+i+1,col=i%5,row=Math.floor(i/5),x=-260+col*130,y=405-row*158,required=SaveService.requiredStars(id),videoOpen=!!s.videoUnlockedLevels[String(id)],available=id===1||total>=required||videoOpen,n=this.art(this.root,'button_circle',x,y,116,116);
        n.name='Level_'+id;n.getComponent(Sprite)!.color=available?Color.WHITE:new Color('#A9AAA2');n.addComponent(Button);n.on(Button.EventType.CLICK,()=>{AudioService.playButton();available?this.startLevel(id):this.showLevelGate(id,required);},this);this.text(n,String(id),0,6,29,available?C.ink:new Color('#777D78'),70);
        const stars=s.levelStars[String(id)]||0;for(let star=0;star<3;star++){const icon=this.art(n,'star_filled',-28+star*28,-35,25,25);icon.getComponent(Sprite)!.color=star<stars?Color.WHITE:new Color(105,112,106,105);}
        if(!available){this.art(n,'lock_video',37,37,32,32);const gate=this.panel(n,'GateRequirement',0,-64,98,34,new Color(255,249,231,248),17),g=gate.getComponent(Graphics)!;g.strokeColor=C.gold;g.lineWidth=2;g.roundRect(-49,-17,98,34,17);g.stroke();this.text(gate,String(required),-9,0,16,C.ink,54);this.art(gate,'star_filled',25,0,22,22);}
    }this.text(this.root,`第 ${this.levelPage+1} / 2 页`,0,-585,20,C.ink,170);if(this.levelPage>0){const prev=this.artButton(this.root,'ui_back',-125,-585,54,()=>this.showLevels(0));prev.name='PreviousPage';}if(this.levelPage<1){const next=this.artButton(this.root,'ui_back',125,-585,54,()=>this.showLevels(1));next.name='NextPage';next.setRotationFromEuler(0,0,180);}}
    private startLevel(id: number) {
        this.clear();const level=LEVELS[id-1];
        this.model = new ArrangementModel(level,SaveService.load().props);
        this.tutorialStep=id===1&&SaveService.load().tutorialStep===0?0:-1;
        this.background();
        this.fullPanel(this.root,'PlayfieldSoftener',new Color(255,252,244,34));
        this.panel(this.root, 'TopBar', 0, 548, 730, 205, new Color(255, 255, 255, 235), 34);
        this.artButton(this.root,'ui_back',-305,565,66,()=>this.confirmExit());
        this.artButton(this.root,'ui_pause',305,565,66,()=>this.pause());
        this.text(this.root, `第 ${id} 关`, 0, 600, 28, C.ink, 420);
        this.timeLabel = this.text(this.root, '', 0, 548, 30, C.rose, 180);
        this.progressLabel = this.text(this.root, '', 0, 500, 19, C.sage, 550);
        this.vaseArea = new Node('VaseArea');
        this.vaseArea.addComponent(UITransform).setContentSize(750, 870);
        this.vaseArea.setPosition(0, -35);
        this.root.addChild(this.vaseArea);
        this.propArea = new Node('Props');
        this.propArea.addComponent(UITransform).setContentSize(740, 150);
        this.propArea.setPosition(0, -565);
        this.root.addChild(this.propArea);
        this.render();
        if (this.tutorialStep >= 0)
            this.scheduleOnce(()=>this.startTutorialGuide(),.35);
        else this.scheduleDeadlockCheck(.18);
    }
    private render() { this.renderVases(); this.renderProps(); this.refreshHud(); }
    private flowerInsertOffset(_id:string){return 0;}
    private flowerSlotX(id:string,slot:number,ghost=false){const spread=id==='freesia'?(ghost?18:25):id==='rose'||id==='sunflower'?(ghost?24:32):(ghost?22:29);return(slot-1)*spread;}
    private flowerSlotRotation(id:string,slot:number){const left=id==='freesia'?34:id==='rose'||id==='sunflower'?32:30,right=id==='freesia'?29:id==='rose'||id==='sunflower'?27:26;return[left,0,-right][slot]||0;}
    private displaySlot(index:number,count:number){return flowerVisualSlot(index,count);}
    private defaultVisualSlots(count:number){return Array.from({length:count},(_,index)=>this.displaySlot(index,count));}
    private captureVisualState(){const state=new Map<string,{flowers:string[];slots:number[]}>();if(!this.model)return state;for(const vase of this.model.state.vases){const flowers=this.model.visible(vase.id),slots=(this.vaseVisualSlots.get(vase.id)||this.defaultVisualSlots(flowers.length)).slice();state.set(vase.id,{flowers,slots});}return state;}
    private reconcileVisualSlots(before:Map<string,{flowers:string[];slots:number[]}>){if(!this.model)return;for(const vase of this.model.state.vases){const flowers=this.model.visible(vase.id),old=before.get(vase.id);if(!old){this.vaseVisualSlots.set(vase.id,this.defaultVisualSlots(flowers.length));continue;}const used=old.flowers.map(()=>false),slots:number[]=[];for(const flower of flowers){const match=old.flowers.findIndex((item,index)=>!used[index]&&item===flower);if(match>=0){used[match]=true;slots.push(old.slots[match]);}else{const free=[1,0,2].find(slot=>slots.indexOf(slot)<0);slots.push(free??slots.length);}}this.vaseVisualSlots.set(vase.id,slots);}}
    private flowerCenterCorrection(id:string){const offsets:Record<string,number>={anemone:-10,babybreath:3,camellia:-5,carnation:-6,cherry:-10,eucalyptus:7,freesia:13,hibiscus:15,iris:7,lily:5,orchid:6,peony:-3,ranunculus:-7,sunflower:-15,tulip:-14};return offsets[id]||0;}
    private flowerSlotCorrection(id:string,slot:number){if(slot===1)return 0;const correction=this.flowerCenterCorrection(id);return id==='freesia'&&slot===2?-correction:correction;}
    private renderVases() {
        if (!this.model || !this.vaseArea)
            return;
        this.vaseArea.removeAllChildren();
        this.vaseTargets.clear();
        this.dragSources.length=0;
        const pos = createVasePositions(this.model.state.vases.length);
        this.model.state.vases.forEach((v, i) => {
            const vaseCount=this.model!.state.vases.length,compact=vaseCount>6,trio=vaseCount===3,w=trio?240:compact?170:218,n = new Node(v.id);
            n.setPosition(pos[i].x, pos[i].y);
            n.addComponent(UITransform).setContentSize(w, 300);
            this.vaseArea!.addChild(n);
            this.vaseTargets.set(v.id, n);
            n.on(Node.EventType.TOUCH_END,()=>this.placeSelectedFlower(v.id),this);
            if (this.hint?.targetId === v.id) {
                const g = n.addComponent(Graphics);
                g.strokeColor = C.gold;
                g.lineWidth = 6;
                g.roundRect(-w / 2, -160, w, 315, 24);
                g.stroke();
            }
            const skinNo=v.skinId.replace('vase_','');
            const vaseInner=this.art(n,`vase_inner_${skinNo}`,0,-62,trio?165:compact?112:145,trio?188:compact?150:165);vaseInner.setSiblingIndex(0);
            const visible = v.lock&&!v.lock.unlocked?(v.lock.type==='video'?[]:this.model!.peekLocked(v.id)):this.model!.visible(v.id),ghost=this.model!.nextVisible(v.id),ghostYs=[20,32,20];for(let slot=0;slot<ghost.length;slot++){const visualSlot=this.displaySlot(slot,ghost.length),insertOffset=this.flowerInsertOffset(ghost[slot]),centerOffset=this.flowerSlotCorrection(ghost[slot],visualSlot),f=this.art(n,ghost[slot],this.flowerSlotX(ghost[slot],visualSlot,true)+centerOffset,ghostYs[visualSlot]+insertOffset,trio?102:compact?80:93,trio?202:compact?166:186);f.setRotationFromEuler(0,0,this.flowerSlotRotation(ghost[slot],visualSlot));if(ghost[slot]==='freesia'&&visualSlot===2)f.setScale(-1,1,1);f.addComponent(UIOpacity).opacity=70;f.setSiblingIndex(1+slot);}let visualSlots=this.vaseVisualSlots.get(v.id);if(!visualSlots||visualSlots.length!==visible.length){visualSlots=this.defaultVisualSlots(visible.length);this.vaseVisualSlots.set(v.id,visualSlots);}const ys = [30, 44, 30];
            for (let slot = 0; slot < visible.length; slot++) {
                const visualSlot=visualSlots[slot],insertOffset=this.flowerInsertOffset(visible[slot]),centerOffset=this.flowerSlotCorrection(visible[slot],visualSlot),flower = this.art(n, visible[slot], this.flowerSlotX(visible[slot],visualSlot)+centerOffset, ys[visualSlot]+insertOffset, trio?136:compact?108:124, trio?266:compact?221:243);
                flower.setRotationFromEuler(0, 0, this.flowerSlotRotation(visible[slot],visualSlot));
                if(visible[slot]==='freesia'&&visualSlot===2)flower.setScale(-1,1,1);
                const tutorialMove=this.expectedTutorialMove();if((!v.lock||v.lock.unlocked)&&(this.tutorialStep<0||(tutorialMove?.sourceId===v.id&&tutorialMove.slotIndex===slot)))this.enableDrag(flower, v.id, slot,visualSlot);
                if (this.hint?.sourceId === v.id && this.hint.slotIndex === slot) {
                    const g = flower.addComponent(Graphics);
                    g.strokeColor = C.gold;
                    g.lineWidth = 6;
                    g.circle(0, 38, 38);
                    g.stroke();
                }
            }
            const vaseOpaque=this.art(n,`vase_opaque_${skinNo}`,0,-62,trio?165:compact?112:145,trio?188:compact?150:165);vaseOpaque.setSiblingIndex(45);const vaseFront=this.art(n,`vase_front_${skinNo}`,0,-62,trio?165:compact?112:145,trio?188:compact?150:165);vaseFront.setSiblingIndex(50);
            if(v.lock&&!v.lock.unlocked){const lock=this.art(n,'lock_count',0,-36,compact?104:126,compact?134:160);lock.setSiblingIndex(80);lock.addComponent(Button);lock.on(Button.EventType.CLICK,()=>{AudioService.playButton();this.unlockVase(v.id);},this);this.art(lock,'lock_video',0,31,compact?43:49,compact?43:49);if(v.lock.type==='flowers'){const left=Math.max(0,v.lock.required-this.model!.state.eliminatedGroups*3);this.text(lock,String(left),0,-15,compact?31:35,C.ink,82);}else this.text(lock,'视频解锁',0,-28,compact?15:18,C.ink,94);}
        });
    }
    private enableDrag(n:Node,sourceId:string,slotIndex:number,visualSlot:number){
        const touchNode=new Node('FlowerTouchArea');
        touchNode.setPosition([-24,0,24][visualSlot]||0,54);
        touchNode.addComponent(UITransform).setContentSize(64,220);
        n.addChild(touchNode);
        touchNode.setSiblingIndex(200);
        touchNode.on(Node.EventType.TOUCH_START,(event:EventTouch)=>{
            event.propagationStopped=true;
            this.beginFlowerDrag(n,sourceId,slotIndex,event);
        },this);
        touchNode.on(Node.EventType.TOUCH_MOVE,(event:EventTouch)=>this.onBoardTouchMove(event),this);
        touchNode.on(Node.EventType.TOUCH_END,(event:EventTouch)=>this.onBoardTouchEnd(event),this);
        touchNode.on(Node.EventType.TOUCH_CANCEL,(event:EventTouch)=>this.onBoardTouchEnd(event),this);
        this.dragSources.push({touchNode,flowerNode:n,sourceId,slotIndex});
    }
    private onBoardTouchStart(event:EventTouch){
        if(this.activeDrag||this.modal)return;
        const screenPoint=event.getLocation();
        for(let index=this.dragSources.length-1;index>=0;index--){
            const source=this.dragSources[index];
            if(!source.touchNode.isValid||!source.flowerNode.isValid)continue;
            if(source.touchNode.getComponent(UITransform)!.hitTest(screenPoint,event.windowId)){
                this.beginFlowerDrag(source.flowerNode,source.sourceId,source.slotIndex,event);
                return;
            }
        }
    }
    private beginFlowerDrag(node:Node,sourceId:string,slotIndex:number,event:EventTouch){
        if(this.modal||this.activeDrag||!this.model||!this.vaseArea||!node.isValid)return;
        const sprite=node.getComponent(Sprite),transform=node.getComponent(UITransform),vase=node.parent;
        if(!sprite||!transform||!vase)return;
        const originalColor=new Color(sprite.color.r,sprite.color.g,sprite.color.b,sprite.color.a);
        const proxy=new Node('DraggingFlower');
        proxy.addComponent(UITransform).setContentSize(transform.contentSize);
        const proxySprite=proxy.addComponent(Sprite);
        proxySprite.sizeMode=Sprite.SizeMode.CUSTOM;
        proxySprite.spriteFrame=sprite.spriteFrame;
        proxySprite.color=originalColor;
        proxy.setPosition(this.vaseArea.position.x+vase.position.x+node.position.x,this.vaseArea.position.y+vase.position.y+node.position.y);
        proxy.setScale(node.scale);
        this.root.addChild(proxy);
        proxy.setSiblingIndex(this.root.children.length-1);
        sprite.color=new Color(originalColor.r,originalColor.g,originalColor.b,0);
        const touchId=event.getID();
        this.activeDrag={sourceId,slotIndex,node,sprite,originalColor,proxy,proxyStart:proxy.position.clone(),moved:false,touchId,lastUi:event.getUILocation().clone()};
        this.selectedFlower={sourceId,slotIndex};
        this.draggingFlower=true;
        this.timerStarted=true;
        this.deadlockCheckToken++;
    }
    private onBoardTouchMove(event:EventTouch){
        const drag=this.activeDrag;
        if(!drag||!drag.proxy.isValid||drag.touchId!==event.getID())return;
        this.syncDragPosition(drag,event);
    }
    private syncDragPosition(drag:ActiveFlowerDrag,event:EventTouch){
        const current=event.getUILocation(),dx=current.x-drag.lastUi.x,dy=current.y-drag.lastUi.y;
        drag.lastUi.set(current);
        if(Math.abs(dx)+Math.abs(dy)>0)drag.moved=true;
        drag.proxy.setPosition(drag.proxy.position.x+dx,drag.proxy.position.y+dy);
        drag.proxy.setSiblingIndex(this.root.children.length-1);
    }
    private onBoardTouchEnd(event:EventTouch){
        if(!this.activeDrag||this.activeDrag.touchId!==event.getID())return;
        const drag=this.activeDrag;
        this.syncDragPosition(drag,event);
        const target=this.resolveDropTarget(drag,.1);
        if(target)this.finishFlowerDrag(target);
        else this.finishFlowerDrag(null);
    }
    private resolveDropTarget(drag:ActiveFlowerDrag,minOverlapRatio:number){
        const expected=this.expectedTutorialMove();
        if(!this.vaseArea)return null;
        const transform=drag.proxy.getComponent(UITransform)!,scale=drag.proxy.scale;
        const width=transform.contentSize.width*Math.abs(scale.x),height=transform.contentSize.height*Math.abs(scale.y);
        const flowerRect=new Rect(drag.proxy.position.x-width/2,drag.proxy.position.y-height/2,width,height);
        const measured=Array.from(this.vaseTargets.entries()).filter(([id,node])=>id!==drag.sourceId&&node.isValid&&!!this.model?.canReceive(id)&&(!expected||expected.sourceId!==drag.sourceId||expected.slotIndex!==drag.slotIndex||id===expected.targetId)).map(([id,node])=>{
            const size=node.getComponent(UITransform)!.contentSize;
            const centerX=this.vaseArea!.position.x+node.position.x,centerY=this.vaseArea!.position.y+node.position.y;
            const vaseRect=new Rect(centerX-size.width/2-24,centerY-size.height/2-30,size.width+48,size.height+60);
            const overlap=Math.max(0,Math.min(flowerRect.xMax,vaseRect.xMax)-Math.max(flowerRect.xMin,vaseRect.xMin))*Math.max(0,Math.min(flowerRect.yMax,vaseRect.yMax)-Math.max(flowerRect.yMin,vaseRect.yMin));
            const dx=drag.proxy.position.x-centerX,dy=drag.proxy.position.y-centerY;
            return{id,ratio:overlap/(width*height),distance:dx*dx+dy*dy};
        });
        const ranked=measured.filter(item=>item.ratio>=minOverlapRatio).sort((a,b)=>b.ratio-a.ratio||a.distance-b.distance);
        return ranked[0]?.id||null;
    }
    private finishFlowerDrag(targetId:string|null){
        const drag=this.activeDrag;
        if(!drag)return;
        this.activeDrag=null;
        this.draggingFlower=false;
        if(drag.node.isValid)drag.sprite.color=drag.originalColor;
        if(targetId){
            drag.proxy.destroy();
            this.selectedFlower=null;
            this.transfer(drag.sourceId,drag.slotIndex,targetId);
            return;
        }
        if(drag.proxy.isValid)tween(drag.proxy).to(.1,{position:drag.proxyStart}).call(()=>drag.proxy.destroy()).start();
        this.scheduleDeadlockCheck(.02);
    }
    private cancelActiveDrag(){
        const drag=this.activeDrag;
        this.activeDrag=null;
        this.draggingFlower=false;
        if(!drag)return;
        if(drag.node.isValid)drag.sprite.color=drag.originalColor;
        if(drag.proxy.isValid)drag.proxy.destroy();
    }
    private placeSelectedFlower(targetId:string){
        const selected=this.selectedFlower;
        if(!selected||this.activeDrag||targetId===selected.sourceId||!this.model?.canReceive(targetId))return;
        this.selectedFlower=null;
        this.transfer(selected.sourceId,selected.slotIndex,targetId);
    }
    private unlockVase(id:string){if(!this.model)return;this.logVideoClick('花瓶解锁',{vaseId:id,levelId:this.model.level.id});if(this.model.unlockByVideo(id)){this.toast('新花瓶已解锁');this.render();if(this.model.state.status==='won')this.scheduleOnce(()=>this.win(),.3);}}
    private audioSettingRow(parent:Node,title:string,y:number,kind:'music'|'sfx'){this.text(parent,title,-85,y,26,C.ink,230);const state=SaveService.load(),enabled=state[kind],toggle=this.art(parent,'button_circle',145,y,92,92);toggle.name=`Toggle_${kind}`;toggle.getComponent(Sprite)!.color=enabled?Color.WHITE:new Color('#A7AAA2');toggle.addComponent(Button);const label=this.text(toggle,enabled?'开':'关',0,1,23,enabled?C.ink:new Color('#737A75'),60);toggle.on(Button.EventType.CLICK,()=>{AudioService.playButton();const next=!SaveService.load()[kind];SaveService.setAudio(kind,next);AudioService.syncSettings();if(kind==='sfx'&&next)AudioService.playButton();toggle.getComponent(Sprite)!.color=next?Color.WHITE:new Color('#A7AAA2');label.string=next?'开':'关';label.color=next?C.ink:new Color('#737A75');},this);}
    private showSettings(){if(this.modal)return;this.modal=true;const overlay=this.modalPanel(this.root,'Settings',new Color(24,34,29,195)),card=this.artPanel(overlay,'Card',0,0,570,610);this.text(card,'设置',0,190,40,C.ink);this.audioSettingRow(card,'背景音乐',65,'music');this.audioSettingRow(card,'游戏音效',-25,'sfx');this.button(card,'关闭',0,-155,300,70,()=>{overlay.destroy();this.modal=false;});}
    private showLevelGate(id:number,required:number){this.modal=true;const s=this.modalPanel(this.root,'LevelGate',new Color(24,34,29,190)),c=this.artPanel(s,'Card',0,0,560,560);this.text(c,'关卡尚未解锁',0,195,36,C.ink);this.text(c,required>0?`需要累计 ${required} 颗星`:'先完成前一关',0,105,23,C.sage);this.videoButton(c,'观看视频解锁',0,-45,330,76,()=>{SaveService.unlockByVideo(id);this.startLevel(id);});this.button(c,'继续收集星星',0,-155,330,76,()=>{s.destroy();this.modal=false;});}
    private confirmExit(){if(!this.model||this.modal)return;this.model.state.status='paused';this.modal=true;const s=this.modalPanel(this.root,'ExitConfirm',new Color(24,34,29,195)),c=this.artPanel(s,'Card',0,0,560,520);this.text(c,'要离开本关吗？',0,175,36,C.ink);this.text(c,'当前整理进度不会保留',0,90,21,C.sage);this.button(c,'继续整理',0,-40,320,72,()=>{s.destroy();this.modal=false;this.model!.state.status='playing';},true,C.rose);this.button(c,'返回选关',0,-145,320,72,()=>this.showLevels());}
    private transfer(source: string, slotIndex: number, target: string) { if (!this.model)
        return;const expected=this.expectedTutorialMove();if(expected&&(source!==expected.sourceId||slotIndex!==expected.slotIndex||target!==expected.targetId)){this.toast('请按照手指指引移动这朵花');this.render();this.scheduleOnce(()=>this.startTutorialGuide(),.1);return;}const sourceBefore=this.model.visible(source),visualBefore=this.captureVisualState(); const r = this.model.move(source, slotIndex, target); if (!r.accepted) {
        this.toast(r.message || '不能移动');
        this.render();
        return;
    }const sourceState=visualBefore.get(source);if(sourceState){if(sourceBefore.length<=1)visualBefore.delete(source);else{sourceState.flowers.splice(slotIndex,1);sourceState.slots.splice(slotIndex,1);}}if(r.eliminated.length)visualBefore.delete(target);this.reconcileVisualSlots(visualBefore); this.hint = null;this.clearTutorialGuide();if(this.tutorialStep>=0){if(this.tutorialStep===2&&r.eliminated.length){this.tutorialStep=-1;SaveService.markTutorialDone();}else this.tutorialStep++;} PlatformService.vibrate(); this.render();if(r.eliminated.length){this.matchFx(target);AudioService.playMatch();}if(this.tutorialStep>=0)this.scheduleOnce(()=>this.startTutorialGuide(),.2); if (r.won)
        this.scheduleOnce(() => this.win(), .35); else this.scheduleDeadlockCheck(.01); }
    private scheduleDeadlockCheck(delay=.01){const current=this.model;if(current&&!this.draggingFlower&&!this.modal&&current.state.status==='playing'&&!current.state.vases.some(v=>current.canReceive(v.id))){this.deadlockCheckToken++;this.showNoMoves(true);return;}const token=++this.deadlockCheckToken;this.scheduleOnce(async()=>{if(token!==this.deadlockCheckToken||this.draggingFlower||!this.model||this.modal||this.model.state.status!=='playing')return;const model=this.model,canContinue=await model.hasUsefulMoveAsync(()=>token!==this.deadlockCheckToken||this.draggingFlower||this.model!==model||this.modal);if(token!==this.deadlockCheckToken||this.draggingFlower||this.model!==model||this.modal||model.state.status!=='playing')return;if(!canContinue)this.showNoMoves(true);},delay);}
    private showNoMoves(verified=false){if(!this.model||this.modal||this.model.state.status!=='playing'||(!verified&&this.model.hasUsefulMove()))return;this.deadlockCheckToken++;this.model.state.status='paused';this.modal=true;const s=this.modalPanel(this.root,'NoMoves',new Color(24,34,29,200)),c=this.artPanel(s,'Card',0,0,600,690);this.text(c,'暂时没有可移动的位置',0,230,31,C.ink,480);this.text(c,'所有可操作花瓶都已放满，\n当前没有花朵可以移动到其他花瓶。',0,125,20,C.sage,420);this.videoButton(c,'打乱花朵继续',0,-25,300,70,()=>{this.model!.state.status='playing';if(!this.model!.shuffleAll()){this.model!.state.status='paused';this.toast('当前没有足够的花朵可以重排');return;}s.destroy();this.modal=false;this.render();this.scheduleDeadlockCheck(.12);});this.button(c,'重新挑战',0,-125,300,70,()=>this.startLevel(this.model!.level.id),true,C.rose);this.button(c,'返回选关',0,-225,300,70,()=>this.showLevels());}
    private renderProps() { if (!this.model || !this.propArea)return;const a=this.propArea;a.removeAllChildren();(['hourglass','magic','hint'] as PropType[]).forEach((p,i)=>{const [icon,name]=PROP[p],count=this.model!.props[p]||0,x=-195+i*195,n=this.art(a,'button_circle',x,0,148,148);n.name=p;n.addComponent(Button);n.on(Button.EventType.CLICK,()=>{AudioService.playButton();this.useInventoryProp(p,name);},this);this.art(n,icon,0,10,72,72);const label=this.panel(n,'PropLabel',0,-50,132,42,new Color(52,72,64,245),20);this.text(label,name,0,0,23,C.white,124);if(count<=0){const video=this.art(n,'lock_video',53,53,42,42);video.name='VideoBadge';}else{const badge=this.panel(n,'CountBadge',53,53,44,44,C.gold,22);this.text(badge,String(count),0,1,20,C.white,38);}}); }
    private useInventoryProp(p:PropType,name=PROP[p][1]){
        if(!this.model||this.modal)return;
        if((this.model.props[p]||0)<=0){
            this.logVideoClick(`道具：${name}`,{propType:p,levelId:this.model.level.id});
            this.model.props[p]++;
        }
        this.useProp(p);
    }
    private nextLevelId(id:number){return id>=60?1:id+1;}
    private useProp(p: PropType) { if (!this.model)
        return; let ok = false; if (p === 'hourglass')
        ok = this.model.useHourglass(); if (p === 'magic')
        ok = this.model.useMagicAll().length > 0;if(p==='hint'&&this.model.props.hint>0){ok=this.model.shuffleAll();if(ok){this.model.props.hint--;this.hint=null;this.vaseVisualSlots.clear();}}
        SaveService.setProps(this.model.props);if (!ok)
        this.toast(p==='hint'?'当前没有足够的花朵可以重排':'现在还不能使用这个道具'); this.render();if(ok&&p==='hint')this.scheduleDeadlockCheck(.12); if (this.model.state.status === 'won')
        this.scheduleOnce(() => this.win(), .3); }
    private refreshHud() { if (!this.model)
        return; const t = Math.ceil(this.model.state.remainingTime), two = (n: number) => n < 10 ? '0' + n : String(n); if (this.timeLabel&&t!==this.lastHudSecond) {
        this.lastHudSecond=t;this.timeLabel.string = `${two(Math.floor(t / 60))}:${two(t % 60)}`;
        this.timeLabel.color = t <= 15 ? new Color('#E94F6B') : C.rose;
    } if (this.progressLabel) {
        const remaining = this.model.state.vases.reduce((n, v) => n + v.layers.reduce((s, l) => s + l.length, 0), 0);
        if(remaining!==this.lastHudRemaining){this.lastHudRemaining=remaining;this.progressLabel.string = `剩余 ${remaining} 支`;}
    } }
    private win() { if (!this.model || this.modal)
        return; this.modal = true; const d = this.model.resultData(); SaveService.complete(this.model.level.id, d.stars, d.score); this.result('整理完成', d, () => this.startLevel(this.nextLevelId(this.model!.level.id)),d.stars===3?'完美绽放！这束花整理得太漂亮了':d.stars===2?'搭配得很棒，再试一次就能完美通关':'顺利完成，继续收集更多星星吧'); }
    private showFail() { if (!this.model || this.modal)
        return; this.modal = true; const s = this.modalPanel(this.root,'Modal',new Color(24,34,29,205)), c = this.artPanel(s, 'Card', 0, 0, 610, 760); this.text(c, '时间到了', 0, 255, 41, C.ink); this.text(c, '重新观察每个花瓶顶部的花朵，\n优先补齐只差一朵的组合。', 0, 105, 22,C.sage, 500); this.button(c, '重新挑战', 0, -55, 340, 76, () => this.startLevel(this.model!.level.id), true, C.rose); this.videoButton(c, '复活并加 60 秒', 0, -165, 340, 76, () => {s.destroy();this.modal=false;this.model!.revive();this.render();}); this.button(c, '返回选关', 0, -275, 340, 76, () => this.showLevels()); }
    private result(title:string,d:LevelResult,next:()=>void,message='每一朵花都找到了最合适的位置'){const s=this.modalPanel(this.root,'Modal',new Color(24,34,29,205)),c=this.artPanel(s,'Card',0,0,620,700),twoLines=message.indexOf('\n')>=0?message:message.replace('！','！\n').replace('，','，\n');this.text(c,title,0,245,42,C.ink);for(let i=0;i<3;i++){const star=this.art(c,'star_filled',-105+i*105,115,i<d.stars?86:70,i<d.stars?86:70);star.getComponent(Sprite)!.color=i<d.stars?Color.WHITE:new Color(160,160,150,90);}this.text(c,twoLines,0,-5,23,C.sage,500);this.button(c,'下一关',0,-170,320,70,next,true,C.rose);this.button(c,'返回选关',0,-270,320,70,()=>this.showLevels());}
    private pause() { if (!this.model || this.modal)
        return; this.model.state.status = 'paused'; this.modal = true; const s = this.modalPanel(this.root,'Pause',new Color(24,34,29,205)), c = this.artPanel(s, 'Card', 0, 0, 590, 780); this.text(c, '暂停', 0, 290, 40, C.ink);this.audioSettingRow(c,'背景音乐',180,'music');this.audioSettingRow(c,'游戏音效',60,'sfx'); this.button(c, '继续整理', 0, -75, 310, 74, () => { s.destroy(); this.modal = false; this.model!.state.status = 'playing'; }, true, C.rose); this.button(c, '重新开始', 0, -165, 310, 74, () => this.startLevel(this.model!.level.id)); this.button(c, '返回藏品', 0, -255, 310, 74, () => this.showLevels()); }
    private expectedTutorialMove(){if(this.tutorialStep<0)return null;return[{sourceId:'vase_0',slotIndex:0,targetId:'vase_2'},{sourceId:'vase_0',slotIndex:1,targetId:'vase_2'},{sourceId:'vase_1',slotIndex:1,targetId:'vase_2'}][this.tutorialStep]||null;}
    private startTutorialGuide(){if(!this.model||!this.vaseArea||this.model.level.id!==1||this.root.getChildByName('TutorialGuide'))return;const move=this.expectedTutorialMove();if(!move)return;const source=this.vaseTargets.get(move.sourceId),target=this.vaseTargets.get(move.targetId);if(!source||!target)return;const guide=new Node('TutorialGuide'),visible=view.getVisibleSize();guide.addComponent(UITransform).setContentSize(Math.max(750,visible.width),Math.max(1334,visible.height));this.root.addChild(guide);const label=this.panel(guide,'GuideText',0,365,500,62,new Color(52,72,64,238),31);this.text(label,'拖动花朵到花瓶中',0,0,21,C.white,470);const flowerId=this.model.visible(move.sourceId)[move.slotIndex]||'',ys=[30,44,30],fingerTipOffset=70,centerOffset=this.flowerCenterCorrection(flowerId),start=new Vec3(source.position.x+this.flowerSlotX(flowerId,move.slotIndex)+centerOffset,this.vaseArea.position.y+source.position.y+ys[move.slotIndex]-fingerTipOffset),end=new Vec3(target.position.x,this.vaseArea.position.y+target.position.y-fingerTipOffset),finger=this.art(guide,'tutorial_finger',start.x,start.y,94,150);finger.name='TutorialFinger';const animate=()=>{if(!finger.isValid)return;finger.setPosition(start);finger.setScale(1,1);tween(finger).to(.18,{scale:new Vec3(.86,.86,1)}).to(1.05,{position:end}).to(.16,{scale:new Vec3(1,1,1)}).delay(.45).call(animate).start();};animate();}
    private clearTutorialGuide(){const guide=this.root.getChildByName('TutorialGuide');if(guide)guide.destroy();}
    private matchFx(targetId:string){if(!this.vaseArea)return;const vase=this.vaseTargets.get(targetId);if(!vase)return;const fx=new Node('MatchBloomFx');fx.setPosition(vase.position.x,this.vaseArea.position.y+vase.position.y+35);fx.addComponent(UITransform).setContentSize(220,220);const g=fx.addComponent(Graphics);for(let i=0;i<12;i++){const a=Math.PI*2*i/12,r=38+(i%2)*18;g.fillColor=i%2?new Color('#FFD56B'):new Color('#F58DA2');g.circle(Math.cos(a)*r,Math.sin(a)*r,7);g.fill();}const opacity=fx.addComponent(UIOpacity);this.root.addChild(fx);fx.setScale(.45,.45);tween(fx).to(.18,{scale:new Vec3(1.2,1.2,1)}).to(.38,{scale:new Vec3(1.65,1.65,1)}).call(()=>fx.destroy()).start();tween(opacity).delay(.18).to(.38,{opacity:0}).start();}
    private toast(s: string) { const n = this.panel(this.root, 'Toast', 0, 410, 480, 58, C.glass, 29); this.text(n, s, 0, 0, 19, C.white, 440); tween(n).delay(.8).to(.2, { scale: new Vec3(.8, .8, 1) }).call(() => n.destroy()).start(); }
}
