import yaml from "js-yaml";
import fs from 'fs'
import IConfig from "../types/ConfigType"
import Log from '../logger/Logger'

class ConfigManager {
    private _config?: IConfig;
    private _lastReadTime?:Date;

    constructor(private configFile:string) {}

    // 읽은지 1분이 넘었으면 새로 설정파일을 읽어와서 반영함.
    get config():IConfig {
        if( this._lastReadTime ) {
            Log.debug(`config loaded at ${this._lastReadTime.getTime()}  now ${Date.now()} `)
        }

        if( !this._config || !this._lastReadTime || (this._lastReadTime && (Date.now() - this._lastReadTime.getTime()) > 60000) ) {
            if( this._lastReadTime && (Date.now() - this._lastReadTime.getTime()) > 60000){
                Log.info(`config loaded at ${this._lastReadTime.getTime()}  now ${Date.now()} config reloaded `)
            }
            const fileContents = fs.readFileSync(this.configFile, 'utf8');
            this._config = yaml.load(fileContents) as IConfig;
            this._lastReadTime = new Date();
        }
        return this._config;
    }
}

export default ConfigManager;