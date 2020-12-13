export class NavParamsMock {
    static returnParam = null;
    public get(key): any {
        if (NavParamsMock.returnParam) {
            return NavParamsMock.returnParam
        }
        return 'default';
    }
    static setParams(value) {
        NavParamsMock.returnParam = value;
    }
}