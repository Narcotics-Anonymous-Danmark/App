export class LoadingServiceMock {
    present(message) {
        console.log('Loader: ' + message);
    }
    dismiss() {
        console.log('Loader dismissed.');
    }
}