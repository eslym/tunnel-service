"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutError = void 0;
class TimeoutError extends Error {
    constructor() {
        super();
        Object.setPrototypeOf(this, TimeoutError.prototype);
    }
}
exports.TimeoutError = TimeoutError;

//# sourceMappingURL=errors.js.map
