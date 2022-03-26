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
var _FileUserProvider_directory, _FileUser_configPath, _DefaultAgentPool_agentSelector, _DefaultAgentPool_agentIndex, _DefaultAgentPool_domains;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpCatsErrorResponseHandler = exports.TextPlainErrorResponseHandler = exports.DefaultAgentPool = exports.FileUserProvider = void 0;
const events_1 = require("events");
const path = require("path");
const fs = require("fs");
const ssh2_1 = require("ssh2");
const crypto_1 = require("crypto");
const utils_1 = require("./utils");
const util = require("util");
const https = require("https");
const JSON5 = require("json5");
const YAML = require("yaml");
const bcrypt = require("bcrypt");
var parseKey = ssh2_1.utils.parseKey;
const ConfigLoader = {};
function yamlLoader(path) {
    return __awaiter(this, void 0, void 0, function* () {
        let buff = (yield util.promisify(fs.readFile)(path)).toString();
        return YAML.parse(buff);
    });
}
function jsonLoader(path) {
    return __awaiter(this, void 0, void 0, function* () {
        let buff = (yield util.promisify(fs.readFile)(path)).toString();
        return JSON.parse(buff);
    });
}
function json5Loader(path) {
    return __awaiter(this, void 0, void 0, function* () {
        let buff = (yield util.promisify(fs.readFile)(path)).toString();
        return JSON5.parse(buff);
    });
}
ConfigLoader['.yml'] = ConfigLoader['.yaml'] = yamlLoader;
ConfigLoader['.json'] = jsonLoader;
ConfigLoader['.json5'] = json5Loader;
// Code from ssh2 example
function checkValue(input, allowed) {
    const autoReject = (input.length !== allowed.length);
    if (autoReject) {
        // Prevent leaking length information by always making a comparison with the
        // same input when lengths don't match what we expect ...
        allowed = input;
    }
    const isMatch = (0, crypto_1.timingSafeEqual)(input, allowed);
    return (!autoReject && isMatch);
}
function authKey(context, key) {
    return context.key.algo === key.type &&
        checkValue(context.key.data, key.getPublicSSH()) &&
        (!context.signature || key.verify(context.blob, context.signature) === true);
}
class FileUserProvider extends events_1.EventEmitter {
    constructor(directory) {
        super();
        _FileUserProvider_directory.set(this, void 0);
        __classPrivateFieldSet(this, _FileUserProvider_directory, path.resolve(directory), "f");
    }
    findUser(username, client) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let ext of Object.keys(ConfigLoader)) {
                let file = path.join(__classPrivateFieldGet(this, _FileUserProvider_directory, "f"), `${username}${ext}`);
                if (!fs.existsSync(file)) {
                    continue;
                }
                try {
                    yield ConfigLoader[ext](file);
                    return new FileUser(username, file);
                }
                catch (e) {
                }
            }
            return undefined;
        });
    }
}
exports.FileUserProvider = FileUserProvider;
_FileUserProvider_directory = new WeakMap();
class FileUser {
    constructor(username, configPath) {
        _FileUser_configPath.set(this, void 0);
        this.username = username;
        __classPrivateFieldSet(this, _FileUser_configPath, configPath, "f");
    }
    authKey(context) {
        return __awaiter(this, void 0, void 0, function* () {
            let config = yield this.loadConfig();
            if (!config.hasOwnProperty('keys')) {
                return false;
            }
            for (let key of config.keys) {
                let parsed = parseKey(key);
                if (parsed instanceof Error) {
                    continue;
                }
                if (!Array.isArray(parsed)) {
                    parsed = [parsed];
                }
                if (parsed.some(k => authKey(context, k))) {
                    return true;
                }
            }
            return false;
        });
    }
    authPassword(password) {
        return this.loadConfig().then((config) => {
            if (!config.hasOwnProperty('password')) {
                return false;
            }
            return bcrypt.compare(password, config.password);
        });
    }
    canBind(domain, protocol) {
        return __awaiter(this, void 0, void 0, function* () {
            let config = yield this.loadConfig();
            let validator = new utils_1.DomainMapping();
            for (let pattern of config.domains) {
                validator.addByPattern(pattern, true);
            }
            return validator.resolve(domain).found;
        });
    }
    loadConfig() {
        return __awaiter(this, void 0, void 0, function* () {
            let ext = path.extname(__classPrivateFieldGet(this, _FileUser_configPath, "f"));
            let config = yield ConfigLoader[ext](__classPrivateFieldGet(this, _FileUser_configPath, "f"));
            if (!config.hasOwnProperty('domains')) {
                throw new Error('User domains is required');
            }
            if (!Array.isArray(config.domains) || config.domains.some(d => typeof d !== 'string')) {
                throw new Error('User domains must be an array of string');
            }
            if (!config.hasOwnProperty('password') && !config.hasOwnProperty('keys')) {
                throw new Error("User doesn't have any authentication method");
            }
            if (config.hasOwnProperty('password') && typeof config.password !== 'string') {
                throw new Error('Password signature must be a string');
            }
            if (config.hasOwnProperty('keys') &&
                (!Array.isArray(config.keys) ||
                    config.keys.some(k => typeof k !== 'string'))) {
                if (!Array.isArray(config.keys)) {
                    throw new Error('Public keys must be an array of string');
                }
            }
            return config;
        });
    }
}
_FileUser_configPath = new WeakMap();
class DefaultAgentPool {
    constructor(selector) {
        _DefaultAgentPool_agentSelector.set(this, void 0);
        _DefaultAgentPool_agentIndex.set(this, void 0);
        _DefaultAgentPool_domains.set(this, void 0);
        __classPrivateFieldSet(this, _DefaultAgentPool_agentSelector, selector, "f");
        __classPrivateFieldSet(this, _DefaultAgentPool_agentIndex, new Map(), "f");
        __classPrivateFieldSet(this, _DefaultAgentPool_domains, new utils_1.DomainMapping(), "f");
    }
    attach(agent) {
        if (!__classPrivateFieldGet(this, _DefaultAgentPool_domains, "f").hasPattern(agent.binding)) {
            let map = new Map();
            map.set(agent.uuid, agent);
            __classPrivateFieldGet(this, _DefaultAgentPool_agentIndex, "f").set(agent.uuid, map);
            __classPrivateFieldGet(this, _DefaultAgentPool_domains, "f").addByPattern(agent.binding, map);
            return;
        }
        let map = __classPrivateFieldGet(this, _DefaultAgentPool_domains, "f").getByPattern(agent.binding);
        map.set(agent.uuid, agent);
        __classPrivateFieldGet(this, _DefaultAgentPool_agentIndex, "f").set(agent.uuid, map);
    }
    detach(agent) {
        let map = __classPrivateFieldGet(this, _DefaultAgentPool_agentIndex, "f").get(agent.uuid);
        map.delete(agent.uuid);
        let p = __classPrivateFieldGet(this, _DefaultAgentPool_domains, "f").getByPattern(agent.binding);
        if (p && p.size === 0) {
            __classPrivateFieldGet(this, _DefaultAgentPool_domains, "f").removePattern(agent.binding);
        }
    }
    detachAll(client) {
        for (let agent of client.agents) {
            this.detach(agent);
        }
    }
    isAvailable(domain) {
        let result = __classPrivateFieldGet(this, _DefaultAgentPool_domains, "f").resolve(domain);
        let sample = Array.from(result.value.values())
            .filter(p => p.state === 'active');
        return result.found && sample.length > 0;
    }
    select(domain) {
        let result = __classPrivateFieldGet(this, _DefaultAgentPool_domains, "f").resolve(domain);
        if (!result.found) {
            return false;
        }
        let sample = Array.from(result.value.values())
            .filter(p => p.state === 'active');
        return __classPrivateFieldGet(this, _DefaultAgentPool_agentSelector, "f").call(this, sample);
    }
}
exports.DefaultAgentPool = DefaultAgentPool;
_DefaultAgentPool_agentSelector = new WeakMap(), _DefaultAgentPool_agentIndex = new WeakMap(), _DefaultAgentPool_domains = new WeakMap();
class TextPlainErrorResponseHandler {
    badGateway(request, response) {
        response.status(502)
            .header('Content-Type', 'text/plain')
            .send('502 Bad Gateway');
    }
    serviceUnavailable(request, response) {
        response.status(503)
            .header('Content-Type', 'text/plain')
            .send('503 Service Unavailable');
    }
    gatewayTimeout(request, response) {
        response.status(504)
            .header('Content-Type', 'text/plain')
            .send('504 Gateway Timeout');
    }
}
exports.TextPlainErrorResponseHandler = TextPlainErrorResponseHandler;
class HttpCatsErrorResponseHandler {
    handle(status) {
        return new Promise((resolve, reject) => {
            https.request({
                method: 'get',
                path: `/${status}`,
                host: 'http.cat',
            })
                .on('response', (res) => {
                resolve(res);
            })
                .once('error', reject)
                .end();
        });
    }
    badGateway(request, response) {
        return this.handle(502).then((incoming) => {
            response.status(502)
                .header('connection', 'close')
                .header('content-type', incoming.headers['content-type'])
                .header('content-length', incoming.headers['content-length'])
                .header('content-disposition', `inline; filename="502 Bad Gateway.jpg"`);
            incoming.pipe(response);
        });
    }
    gatewayTimeout(request, response) {
        return this.handle(504).then((incoming) => {
            response.status(504)
                .header('connection', 'close')
                .header('content-type', incoming.headers['content-type'])
                .header('content-length', incoming.headers['content-length'])
                .header('content-disposition', `inline; filename="504 Gateway Timeout.jpg"`);
            incoming.pipe(response);
        });
    }
    serviceUnavailable(request, response) {
        return this.handle(503).then((incoming) => {
            response.status(503)
                .header('connection', 'close')
                .header('content-type', incoming.headers['content-type'])
                .header('content-length', incoming.headers['content-length'])
                .header('content-disposition', `inline; filename="503 Service Unavailable.jpg"`);
            incoming.pipe(response);
        });
    }
}
exports.HttpCatsErrorResponseHandler = HttpCatsErrorResponseHandler;

//# sourceMappingURL=builtins.js.map
