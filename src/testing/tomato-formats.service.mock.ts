export class TomatoFormatsServiceMock {
    static returnParam = null;
    public getFormatByID(format_shared_id_list, formatLanguage): Promise<string> {
        if (TomatoFormatsServiceMock.returnParam) {
            return TomatoFormatsServiceMock.returnParam
        }
        return new Promise(() => {
            'default';
        });
            
    }
    static setParams(value) {
        TomatoFormatsServiceMock.returnParam = value;
    }
}