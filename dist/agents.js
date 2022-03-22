"use strict";
// noinspection JSUnusedGlobalSymbols
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _HttpAgent_channel, _HttpAgent_client, _HttpAgent_info, _HttpsAgent_channel, _HttpsAgent_client, _HttpsAgent_info;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpsAgent = exports.HttpAgent = void 0;
const http_1 = require("http");
const https = require("https");
const tls = require("tls");
const utils_1 = require("./utils");
// code from ssh2
class HttpAgent extends http_1.Agent {
    constructor(channel, client, info, options) {
        super(options);
        _HttpAgent_channel.set(this, void 0);
        _HttpAgent_client.set(this, void 0);
        _HttpAgent_info.set(this, void 0);
        __classPrivateFieldSet(this, _HttpAgent_channel, channel, "f");
        __classPrivateFieldSet(this, _HttpAgent_client, client, "f");
        __classPrivateFieldSet(this, _HttpAgent_info, info, "f");
    }
    createConnection(options, callback) {
        __classPrivateFieldGet(this, _HttpAgent_info, "f").activeRequests++;
        let sock = (0, utils_1.mockSocket)(__classPrivateFieldGet(this, _HttpAgent_channel, "f"));
        sock.destroySoon = sock.destroy;
        __classPrivateFieldGet(this, _HttpAgent_channel, "f").on('close', () => __classPrivateFieldGet(this, _HttpAgent_info, "f").activeRequests--);
        callback(null, sock);
    }
}
exports.HttpAgent = HttpAgent;
_HttpAgent_channel = new WeakMap(), _HttpAgent_client = new WeakMap(), _HttpAgent_info = new WeakMap();
class HttpsAgent extends https.Agent {
    constructor(channel, client, info, options) {
        super(options);
        _HttpsAgent_channel.set(this, void 0);
        _HttpsAgent_client.set(this, void 0);
        _HttpsAgent_info.set(this, void 0);
        __classPrivateFieldSet(this, _HttpsAgent_channel, channel, "f");
        __classPrivateFieldSet(this, _HttpsAgent_client, client, "f");
        __classPrivateFieldSet(this, _HttpsAgent_info, info, "f");
    }
    createConnection(options, callback) {
        options.socket = __classPrivateFieldGet(this, _HttpsAgent_channel, "f");
        let wrapped = tls.connect(options);
        const onClose = (() => {
            let called = false;
            return () => {
                if (called)
                    return;
                called = true;
                if (__classPrivateFieldGet(this, _HttpsAgent_channel, "f").isPaused())
                    __classPrivateFieldGet(this, _HttpsAgent_channel, "f").resume();
            };
        })();
        // 'end' listener is needed because 'close' is not emitted in some scenarios
        // in node v12.x for some unknown reason
        wrapped.on('end', onClose).on('close', onClose);
        callback(null, wrapped);
    }
}
exports.HttpsAgent = HttpsAgent;
_HttpsAgent_channel = new WeakMap(), _HttpsAgent_client = new WeakMap(), _HttpsAgent_info = new WeakMap();

//# sourceMappingURL=agents.js.map
