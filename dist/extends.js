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
    getAgent(sourceIp, sourcePort) {
        return new Promise((res, rej) => {
            this.client.forwardOut(this.binding, this.port, sourceIp, sourcePort, (err, ch) => {
                if (err) {
                    return rej(err);
                }
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
    createAgentProvider(binding, protocol) {
        return Object.assign(Object.create(AgentProvider.prototype), {
            uuid: (0, crypto_1.randomUUID)(),
            client: this,
            binding, protocol,
            activeRequests: 0,
        });
    }
}
function extendClient(client) {
    let proto = Object.create(Object.getPrototypeOf(client));
    privates.set(client, {
        uuid: (0, crypto_1.randomUUID)(),
        bindings: new Map(),
        logging: false,
        weight: 0,
        pendingLogs: [],
    });
    let descriptors = Object.getOwnPropertyDescriptors(TraitConnection.prototype);
    delete descriptors.constructor;
    Object.defineProperties(proto, descriptors);
    return Object.setPrototypeOf(client, proto);
}
exports.extendClient = extendClient;

//# sourceMappingURL=extends.js.map
