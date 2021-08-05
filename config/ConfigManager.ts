import yaml from "js-yaml";
import fs from 'fs'
import IConfig from "../types/ConfigType"
import Log from '../logger/Logger'
import deepEqual from "deep-equal";

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

            const newConfig = yaml.load(fs.readFileSync(this.configFile, 'utf8')) as IConfig;

            if( deepEqual(this._config, newConfig) ) {
                Log.debug("[ConfigManager.config] config file hasn't changed. skip ")
            } else {
                Log.info(`[ConfigManager.config] config file has changed. Reload config now `)
                this._config = newConfig;
            }
            this._lastReadTime = new Date();
        }
        return this._config;
    }
}