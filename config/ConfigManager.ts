import yaml from "js-yaml";
import fs from 'fs'
import {IConfig} from "../types/Type"

class ConfigManager {
    private _config!: IConfig;

    constructor(configFile:string) {
        let fileContents = fs.readFileSync(configFile, 'utf8');
        this._config = yaml.load(fileContents) as IConfig;
    
        console.log(this._config)
    }

    get config():IConfig {
        return this._config;
    }
}

export default ConfigManager;