export class SyncToDo<T> {
    constructor(public url: string, public body: T, public params: string, public method: 'post' | 'put') { }
}