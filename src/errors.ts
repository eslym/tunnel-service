
export class TimeoutError extends Error {
    constructor() {
        super();
        Object.setPrototypeOf(this, TimeoutError.prototype);
    }
}
