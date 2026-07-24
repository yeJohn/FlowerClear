declare const wx: undefined | {
  vibrateShort?: (options?: object) => void;
};

export class PlatformService {
  static isWechat() { return typeof wx !== 'undefined'; }
  static vibrate() { if (this.isWechat()) wx?.vibrateShort?.({ type: 'light' }); }
}
