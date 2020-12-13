export class StorageMock {
    private store = {};

    get(key: string): Promise<string> {
        return new Promise(() => {
            key in this.store ? this.store[key] : null;
        });
    }

    set(key: string, value: string) {
        this.store[key] = `${value}`;
    }

    remove(key: string) {
        delete this.store[key];
    }

    clear() {
        this.store = {};
    }

    ready(): Promise<boolean> {
        return new Promise(() => { true });
    }
}

//export class StorageMock {
//    private store = {};

//    get(key: string) {
//        return key in this.store ? of(this.store[key]) : of('');
//    }

//    set(key: string, value: string) {
//        this.store[key] = `${value}`;
//    }

//    remove(key: string) {
//        delete this.store[key];
//    }

//    clear() {
//        this.store = {};
//    }
//}
