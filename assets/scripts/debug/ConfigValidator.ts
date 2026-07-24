import { FLOWER_BY_ID, LEVELS } from '../config/GameData';

export class ConfigValidator {
    static validate() {
        const errors: string[] = [];
        if (LEVELS.length !== 60) errors.push('关卡数量必须为 60');
        for (const level of LEVELS) {
            if (level.vaseCount < 3 || level.vaseCount > 9) errors.push(`关卡 ${level.id} 花瓶数量必须为 3—9 个`);
            if (level.groupCount < 2) errors.push(`关卡 ${level.id} 花朵组数过少`);
            if (level.flowerTypes.some(id => !FLOWER_BY_ID[id])) errors.push(`关卡 ${level.id} 存在无效花材`);
            for (const lock of level.lockedVases || []) if (lock.index < 3 || lock.index >= level.vaseCount) errors.push(`关卡 ${level.id} 锁定花瓶位置无效`);
        }
        return errors;
    }
}
