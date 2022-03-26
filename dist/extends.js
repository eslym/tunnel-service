"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extendClient = void 0;
const crypto_1 = require("crypto");
const agents_1 = require("./agents");
const utils_1 = require("./utils");
const errors_1 = require("./errors");
const privates = new WeakMap();
class AgentProvider {
    get weight() {
        if (this.hasOwnProperty('_weight')) {
            return this._weight;
        }
        return this.client.weight;
    }
    set weight(weight) {
        if (!Number.isNaN(weight) && Number.isFinite(weight) && weight > 0) {
            this._weight = weight;
        }
        else {
            delete this._weight;
        }
    }
    get port() {
        return this.protocol === 'http' ? 80 : 443;
    }
    get activeRequests() {
        return this.client.activeRequests;
    }
    set activeRequests(requests) {
        this.client.activeRequests = requests;
    }
    get state() {
        return this.client.state;
    }
    getAgent(sourceIp, sourcePort) {
        if (this.state !== 'active') {
            return new Promise((res, rej) => {
                rej(new Error('This provider is not active.'));
            });
        }
        return new Promise((res, rej) => {
            let before = new Date();
            let to = setTimeout(() => {
                rej(new errors_1.TimeoutError());
                to = undefined;
            }, this.timeout);
            this.client.forwardOut(this.binding, this.port, sourceIp, sourcePort, (err, ch) => {
                if (!to) {
                    // If already timeout close the channel
                    if (!err)
                        ch.close();
                    return;
                }
                clearTimeout(to);
                if (err) {
                    return rej(err);
                }
                let diff = new Date() - before;
                let timeout = () => {
                    ch.emit('error', new errors_1.TimeoutError());
                    ch.close();
                };
                to = setTimeout(timeout, this.timeout - diff);
                this.activeChannels.add(ch);
                ch.once('close', () => {
                    this.activeChannels.delete(ch);
                    clearTimeout(to);
                });
                ch.on('data', () => {
                    clearTimeout(to);
                    to = setTimeout(timeout, this.timeout);
                });
                let claz = this.protocol === 'http' ? agents_1.HttpAgent : agents_1.HttpsAgent;
                res(new claz(ch, this.client, this, {}));
            });
        });
    }
}
class TraitConnection {
    get uuid() {
        return privates.get(this).uuid;
    }
    get agents() {
        return Array.from(privates.get(this).bindings.values());
    }
    get user() {
        return privates.get(this).user;
    }
    get authenticatedContext() {
        return privates.get(this).authenticatedContext;
    }
    set authenticatedContext(context) {
        privates.get(this).authenticatedContext = context;
    }
    get bindings() {
        return privates.get(this).bindings;
    }
    get console() {
        return privates.get(this).mainIO;
    }
    set console(console) {
        let props = privates.get(this);
        props.mainIO = console;
        while (props.pendingLogs.length) {
            console.log(props.pendingLogs.shift());
        }
    }
    get weight() {
        return privates.get(this).weight;
    }
    set weight(weight) {
        privates.get(this).weight = weight;
    }
    get activeRequests() {
        return privates.get(this).activeRequests;
    }
    set activeRequests(requests) {
        privates.get(this).activeRequests = requests;
    }
    get state() {
        return privates.get(this).state;
    }
    pause() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state !== 'active') {
                return;
            }
            privates.get(this).state = 'pausing';
            this.log('Pausing tunnel.', true).catch();
            let count = 0;
            while (this.state === 'pausing') {
                if (this.activeRequests === 0 || count >= 100) {
                    break;
                }
                count++;
                yield (0, utils_1.wait)(50);
            }
            if (this.state !== 'pausing') {
                return;
            }
            for (let agent of this.bindings.values()) {
                for (let ch of agent.activeChannels) {
                    ch.close();
                }
            }
        });
    }
    resume() {
        if (this.state !== 'pausing') {
            return;
        }
        privates.get(this).state = 'active';
        this.log('Tunnel resumed.', true).catch();
    }
    shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state === 'shutting-down') {
                return;
            }
            privates.get(this).state = 'shutting-down';
            this.log('Shutting down tunnel.', true).catch();
            let count = 0;
            while (true) {
                if (this.activeRequests === 0 || count >= 100) {
                    break;
                }
                yield (0, utils_1.wait)(50);
                count++;
            }
            this.end();
        });
    }
    log(message, force) {
        return __awaiter(this, void 0, void 0, function* () {
            let props = privates.get(this);
            if (this.console) {
                if (force || props.logging) {
                    this.console.log(message);
                }
            }
            else {
                if (force || props.logging) {
                    props.pendingLogs.push(message);
                }
            }
        });
    }
    setLogging(enable) {
        privates.get(this).logging = enable;
    }
    isBound(domain, protocol) {
        return !this.bindings.hasOwnProperty(domain) ? false :
            this.bindings[domain].protocol === protocol;
    }
    setUser(user) {
        privates.get(this).user = user;
        return this;
    }
    createAgentProvider(binding, protocol, timeout) {
        return Object.assign(Object.create(AgentProvider.prototype), {
            uuid: (0, crypto_1.randomUUID)(),
            client: this,
            binding, protocol,
            activeRequests: 0,
            activeChannels: new Set(),
            timeout: timeout !== null && timeout !== void 0 ? timeout : 30000
        });
    }
}
function extendClient(client) {
    let proto = Object.create(Object.getPrototypeOf(client));
    privates.set(client, {
        uuid: (0, crypto_1.randomUUID)(),
        bindings: new Map(),
        logging: false,
        weight: 1,
        pendingLogs: [],
        activeRequests: 0,
        state: 'active',
    });
    let descriptors = Object.getOwnPropertyDescriptors(TraitConnection.prototype);
    delete descriptors.constructor;
    Object.defineProperties(proto, descriptors);
    return Object.setPrototypeOf(client, proto);
}
exports.extendClient = extendClient;

//# sourceMappingURL=extends.js.map
