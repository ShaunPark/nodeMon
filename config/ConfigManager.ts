import yaml from "js-yaml";
import fs from 'fs'
import IConfig from "../types/ConfigType"
import Log from '../logger/Logger'

export default class ConfigManager {
    private _config: IConfig;
    private _lastReadTime: Date;

    constructor(private configFile: string) {
        this._config = yaml.load(fs.readFileSync(this.configFile, 'utf8')) as IConfig;
        this._lastReadTime = new Date();
    }

    // 읽은지 1분이 넘었으면 새로 설정파일을 읽어와서 반영함.
    get config(): IConfig {
        const now = new Date()

        if ((now.getTime() - this._lastReadTime.getTime()) > 60000) {
            Log.info(`[ConfigManager.config] config loaded at ${this._lastReadTime}  now ${now}. Reload config now `)

            this._config = yaml.load(fs.readFileSync(this.configFile, 'utf8')) as IConfig;
            this._lastReadTime = new Date();
        }
        return this._config;
    }
}