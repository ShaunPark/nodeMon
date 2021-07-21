import Log from '../logger/Logger'

export function chagneMemToNumber  (usage: string): number {
    if (usage.endsWith("Ki")) {
        const index = usage.indexOf("Ki")
        return parseFloat(usage.substr(0, index)) * 1024
    } else if (usage.endsWith("Mi")) {
        const index = usage.indexOf("Mi")
        return parseFloat(usage.substr(0, index)) * 1048576
    } else if (usage.endsWith("Gi")) {
        const index = usage.indexOf("Gi")
        return parseFloat(usage.substr(0, index)) * 1073741824
    } else if (usage.endsWith("Ti")) {
        const index = usage.indexOf("Ti")
        return parseFloat(usage.substr(0, index)) * 1099511627776
    } else if (usage.endsWith("K")) {
        const index = usage.indexOf("K")
        return parseFloat(usage.substr(0, index)) * 1000
    } else if (usage.endsWith("M")) {
        const index = usage.indexOf("M")
        return parseFloat(usage.substr(0, index)) * 1000000
    } else if (usage.endsWith("G")) {
        const index = usage.indexOf("G")
        return parseFloat(usage.substr(0, index)) * 1000000000
    } else if (usage.endsWith("T")) {
        const index = usage.indexOf("T")
        return parseFloat(usage.substr(0, index)) * 1000000000000
    } else if (usage.indexOf("e") >= 0) {
        const arr = usage.split("e")
        return parseFloat(arr[0]) * Math.pow(10, parseInt(arr[1]))
    }
    return parseFloat(usage)
}

export function betweenTimes(target: Date, from: Date, to: Date): boolean {
    const stTime = new Date(target)
    stTime.setHours(from.getHours(), from.getMinutes(), from.getSeconds(), 0)
    const edTime = new Date(target)
    edTime.setHours(to.getHours(), to.getMinutes(), to.getSeconds(), 0)

    Log.debug( `Target: ${target}`)
    Log.debug( `from  : ${stTime}`)
    Log.debug( `to    : ${edTime}`)
    return stTime.getTime() < target.getTime() && edTime.getTime() > target.getTime()
}

export function parseTimeStr(str: string): Date {
    const tempDt = new Date("2021-07-20T" + str.trim())
    const dt = new Date()
    dt.setHours(tempDt.getHours(), tempDt.getMinutes(),0,0)
    return dt
}

export function timeStrToDate(timeStr: string, def: string): Date {
    try {
        return parseTimeStr(timeStr)
    } catch (err) {
        Log.error(err)
        return parseTimeStr(def)
    }
}