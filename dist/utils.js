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
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _DomainMapping_instances, _DomainMapping_mapping, _DomainMapping_resolve;
Object.defineProperty(exports, "__esModule", { value: true });
exports.wait = exports.DomainMapping = exports.selectLessRequest = exports.selectRandomly = exports.promise = void 0;
const punycode = require("punycode");
function promise(value) {
    return __awaiter(this, void 0, void 0, function* () {
        return value;
    });
}
exports.promise = promise;
function calPriority(agent, criteria) {
    return criteria / agent.weight;
}
function selectRandomly(agents) {
    if (agents.length === 0) {
        return undefined;
    }
    let bias = new Map();
    function getBias(agent) {
        if (!bias.has(agent)) {
            bias.set(agent, Math.random());
        }
        return bias.get(agent);
    }
    return agents.sort((a, b) => calPriority(a, getBias(a)) -
        calPriority(b, getBias(b)))[0];
}
exports.selectRandomly = selectRandomly;
function selectLessRequest(agents) {
    if (agents.length === 0) {
        return undefined;
    }
    let bias = new Map();
    function getBias(agent) {
        if (!bias.has(agent)) {
            bias.set(agent, Math.random());
        }
        return bias.get(agent);
    }
    let sorted = agents.sort((a, b) => {
        let res = calPriority(a, a.activeRequests) -
            calPriority(b, b.activeRequests);
        return res === 0 ? getBias(a) - getBias(b) : res;
    });
    return sorted[0];
}
exports.selectLessRequest = selectLessRequest;
function validatePattern(pattern) {
    let parts = pattern.split('.')
        .map(punycode.toASCII);
    let invalid = parts
        .filter(p => !['*', '**'].includes(p))
        .some(p => !p.length || /[^a-z0-9-_]/i.test(p));
    if (invalid || /\.\*\*/.test(pattern)) {
        throw new Error('Invalid domain pattern');
    }
}
class DomainMapping {
    constructor() {
        _DomainMapping_instances.add(this);
        _DomainMapping_mapping.set(this, new Map());
    }
    resolve(domain) {
        return __classPrivateFieldGet(this, _DomainMapping_instances, "m", _DomainMapping_resolve).call(this, domain.split('.'), []);
    }
    getByPattern(pattern) {
        return __classPrivateFieldGet(this, _DomainMapping_mapping, "f").get(pattern);
    }
    hasPattern(pattern) {
        return __classPrivateFieldGet(this, _DomainMapping_mapping, "f").has(pattern);
    }
    addByPattern(pattern, value) {
        validatePattern(pattern);
        __classPrivateFieldGet(this, _DomainMapping_mapping, "f").set(pattern, value);
        return this;
    }
    removePattern(pattern) {
        validatePattern(pattern);
        __classPrivateFieldGet(this, _DomainMapping_mapping, "f").delete(pattern);
        return this;
    }
}
exports.DomainMapping = DomainMapping;
_DomainMapping_mapping = new WeakMap(), _DomainMapping_instances = new WeakSet(), _DomainMapping_resolve = function _DomainMapping_resolve(left, right) {
    let subject = right.join('.');
    if (left.length === 0) {
        return {
            value: __classPrivateFieldGet(this, _DomainMapping_mapping, "f").get(subject),
            found: __classPrivateFieldGet(this, _DomainMapping_mapping, "f").has(subject),
        };
    }
    let sub = left.pop();
    if (sub === '**') {
        // When doing pattern matching, catch all should match only with catch all
        return __classPrivateFieldGet(this, _DomainMapping_instances, "m", _DomainMapping_resolve).call(this, [], ['**'].concat(right));
    }
    let res = __classPrivateFieldGet(this, _DomainMapping_instances, "m", _DomainMapping_resolve).call(this, Array.from(left), [sub].concat(right));
    if (!res.found) {
        res = __classPrivateFieldGet(this, _DomainMapping_instances, "m", _DomainMapping_resolve).call(this, Array.from(left), ['*'].concat(right));
    }
    if (!res.found) {
        res = __classPrivateFieldGet(this, _DomainMapping_instances, "m", _DomainMapping_resolve).call(this, [], ['**'].concat(right));
    }
    return res;
};
function wait(milliseconds) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((res) => setTimeout(res, milliseconds));
    });
}
exports.wait = wait;

//# sourceMappingURL=utils.js.map
