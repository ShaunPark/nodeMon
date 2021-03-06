import Log from '../logger/Logger'

export function chagneMemToNumber(usage: string): number {
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

    Log.debug(`[Utils.betweenTimes] target: ${target.toLocaleString()}, from: ${stTime.toLocaleString()}, to: ${edTime.toLocaleString()}`)
    return stTime.getTime() < target.getTime() && edTime.getTime() > target.getTime()
}

export function parseTimeStr(str: string): Date {
    const tempDt = new Date("2021-07-20T" + str.trim())
    const dt = new Date()
    dt.setHours(tempDt.getHours(), tempDt.getMinutes(), 0, 0)
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

export function buildExpr(labelSelector?: string, labelSelectorExpr?: string): string | undefined {
    const labels = stringsToArray(labelSelector)
    const builtExpr = labels.map(lbl => `metadata.labels['${lbl.key}'] == '${lbl.value}'`).join(" || ")
    return (labels.length == 0) ? labelSelectorExpr : builtExpr 
}

const  stringsToArray = (str?: string): Array<{key:string, value:string}> => {
    if (str == undefined) {
        return new Array<{key:string, value:string}>()
    }
    const array = new Array<{key:string, value:string}>()
    const strs = str.trim().split(",")
    strs.forEach(s => {
        const values = s.trim().split("=")
        array.push({ key: values[0], value: values.slice(1).join("=") })
    })
    return array
}
