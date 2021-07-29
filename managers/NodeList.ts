export class NodeList<T> {
    private list:Array<T> = []

    add = (node: T) => {
        this.list.push(node)
    }

    reset = () => {
        this.list = new Array<T>();
    }

    delete = (node: T) => {
        this.list.filter(item =>  item != node)
    }

    length = (): number => {
        return this.list.length
    }

    get = (): Array<T> => {
        return this.list
    }

    set = (newList: Array<T>) => {
        this.list = newList
    }

    merge(addList: T[]) {
        this.list = [...this.list, ...addList]
    }

    slice(num: number) {
        this.list = this.list.slice(0, num)
    }

    includes(nodeName: T) {
        return this.list.includes(nodeName)
    }
}