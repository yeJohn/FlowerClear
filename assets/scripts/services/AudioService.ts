import { AudioClip, AudioSource, EventMouse, EventTouch, input, Input, Node, resources } from 'cc';
import { SaveService } from './SaveService';

export class AudioService {
    private static host:Node|null=null;
    private static music:AudioSource|null=null;
    private static sfx:AudioSource|null=null;
    private static musicClip:AudioClip|null=null;
    private static matchClip:AudioClip|null=null;
    private static buttonClip:AudioClip|null=null;
    private static loading=false;
    private static musicRequested=false;
    private static gestureUnlocked=false;

    static initialize(gameNode:Node){
        if(this.host||this.loading)return;
        this.loading=true;
        const host=gameNode;this.host=host;
        this.music=host.addComponent(AudioSource);this.music.loop=true;this.music.volume=.32;this.music.playOnAwake=true;
        this.sfx=host.addComponent(AudioSource);this.sfx.volume=.8;
        this.musicRequested=SaveService.load().music;
        input.on(Input.EventType.TOUCH_START,this.onFirstTouch,this);
        input.on(Input.EventType.MOUSE_DOWN,this.onFirstMouse,this);
        let pending=3;const done=()=>{if(--pending===0){this.loading=false;this.syncSettings();}};
        resources.load('audio/garden_bgm',AudioClip,(error,clip)=>{if(!error&&clip){this.musicClip=clip;this.music!.clip=clip;this.tryStartMusic();}else console.error('背景音乐加载失败',error);done();});
        resources.load('audio/match_triple',AudioClip,(error,clip)=>{if(!error&&clip)this.matchClip=clip;else console.error('消除音效加载失败',error);done();});
        resources.load('audio/button_click',AudioClip,(error,clip)=>{if(!error&&clip)this.buttonClip=clip;else console.error('按钮音效加载失败',error);done();});
    }

    private static onFirstTouch(_event:EventTouch){this.unlockFromGesture();}
    private static onFirstMouse(_event:EventMouse){this.unlockFromGesture();}

    private static unlockFromGesture(){
        this.gestureUnlocked=true;
        this.tryStartMusic();
    }

    private static tryStartMusic(){
        if(SaveService.load().music&&this.musicRequested&&this.music&&this.musicClip&&!this.music.playing)this.music.play();
    }

    static syncSettings(){
        const save=SaveService.load();
        if(save.music)this.playMusic();else this.pauseMusic();
        if(this.sfx)this.sfx.volume=save.sfx?.8:0;
    }

    static playMusic(){
        this.musicRequested=true;
        if(!SaveService.load().music||!this.music||!this.musicClip)return;
        if(this.gestureUnlocked)this.tryStartMusic();
    }

    static pauseMusic(){
        this.musicRequested=false;
        this.music?.pause();
    }

    static ensureMusic(){this.playMusic();}

    static playMatch(){
        if(!SaveService.load().sfx||!this.sfx||!this.matchClip)return;
        this.sfx.playOneShot(this.matchClip,.9);
    }

    static playButton(){
        this.syncSettings();
        this.ensureMusic();
        if(!SaveService.load().sfx||!this.sfx||!this.buttonClip)return;
        this.sfx.playOneShot(this.buttonClip,.65);
    }
}
