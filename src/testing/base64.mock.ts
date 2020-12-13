export class Base64Mock {
    static returnParam = null;
    public encodeFile(input): Promise<string> {
        if (Base64Mock.returnParam) {
            return Base64Mock.returnParam
        }
        return new Promise(() => {
            'default';
        });

    }
    static setParams(value) {
        Base64Mock.returnParam = value;
    }
}