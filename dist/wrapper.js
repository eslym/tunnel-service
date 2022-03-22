"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafeWrapped = void 0;
const utils_1 = require("./utils");
const wrapped = new WeakMap();
function wrap(target, type) {
    if (typeof target !== 'object') {
        return target;
    }
    if (target instanceof type) {
        return target;
    }
    if (!wrapped.has(target)) {
        wrapped.set(target, new type(target));
    }
    return wrapped.get(target);
}
/**
 * SafeWrapped Namespace
 *
 * Wrap contracts object and only expose the API
 */
var SafeWrapped;
(function (SafeWrapped) {
    var _User_user, _ClientConnection_client, _UserProvider_provider, _AgentProvider_agent, _AgentPool_pool, _ErrorResponseHandler_handler;
    class User {
        constructor(user) {
            _User_user.set(this, void 0);
            __classPrivateFieldSet(this, _User_user, user, "f");
        }
        get username() {
            return __classPrivateFieldGet(this, _User_user, "f").username;
        }
        static wrap(user) {
            return wrap(user, User);
        }
        authKey(context) {
            return __classPrivateFieldGet(this, _User_user, "f").authKey(context);
        }
        authPassword(password) {
            return __classPrivateFieldGet(this, _User_user, "f").authPassword(password);
        }
        canBind(domain, protocol) {
            return __classPrivateFieldGet(this, _User_user, "f").canBind(domain, protocol);
        }
    }
    _User_user = new WeakMap();
    SafeWrapped.User = User;
    class ClientConnection {
        constructor(client) {
            _ClientConnection_client.set(this, void 0);
            __classPrivateFieldSet(this, _ClientConnection_client, client, "f");
        }
        get uuid() {
            return __classPrivateFieldGet(this, _ClientConnection_client, "f").uuid;
        }
        get user() {
            return User.wrap(__classPrivateFieldGet(this, _ClientConnection_client, "f").user);
        }
        get authenticatedContext() {
            return __classPrivateFieldGet(this, _ClientConnection_client, "f").authenticatedContext;
        }
        get agents() {
            return __classPrivateFieldGet(this, _ClientConnection_client, "f").agents.map(AgentProvider.wrap);
        }
        get activeRequests() {
            return __classPrivateFieldGet(this, _ClientConnection_client, "f").activeRequests;
        }
        get state() {
            return __classPrivateFieldGet(this, _ClientConnection_client, "f").state;
        }
        static wrap(client) {
            return wrap(client, ClientConnection);
        }
        log(message, force) {
            return __classPrivateFieldGet(this, _ClientConnection_client, "f").log(message, force);
        }
        isBound(domain, protocol) {
            return __classPrivateFieldGet(this, _ClientConnection_client, "f").isBound(domain, protocol);
        }
    }
    _ClientConnection_client = new WeakMap();
    SafeWrapped.ClientConnection = ClientConnection;
    class UserProvider {
        constructor(provider) {
            _UserProvider_provider.set(this, void 0);
            __classPrivateFieldSet(this, _UserProvider_provider, provider, "f");
        }
        static wrap(provider) {
            return wrap(provider, UserProvider);
        }
        findUser(username, client) {
            return (0, utils_1.promise)(__classPrivateFieldGet(this, _UserProvider_provider, "f").findUser(username, client)).then(User.wrap);
        }
        off(event, listener) {
            __classPrivateFieldGet(this, _UserProvider_provider, "f").off(event, listener);
            return this;
        }
        on(event, listener) {
            __classPrivateFieldGet(this, _UserProvider_provider, "f").on(event, listener);
            return this;
        }
        once(event, listener) {
            __classPrivateFieldGet(this, _UserProvider_provider, "f").once(event, listener);
            return this;
        }
    }
    _UserProvider_provider = new WeakMap();
    SafeWrapped.UserProvider = UserProvider;
    class AgentProvider {
        constructor(agent) {
            _AgentProvider_agent.set(this, void 0);
            __classPrivateFieldSet(this, _AgentProvider_agent, agent, "f");
        }
        get uuid() {
            return __classPrivateFieldGet(this, _AgentProvider_agent, "f").uuid;
        }
        get client() {
            return ClientConnection.wrap(__classPrivateFieldGet(this, _AgentProvider_agent, "f").client);
        }
        get protocol() {
            return __classPrivateFieldGet(this, _AgentProvider_agent, "f").protocol;
        }
        get weight() {
            return __classPrivateFieldGet(this, _AgentProvider_agent, "f").weight;
        }
        get activeRequests() {
            return __classPrivateFieldGet(this, _AgentProvider_agent, "f").activeRequests;
        }
        get binding() {
            return __classPrivateFieldGet(this, _AgentProvider_agent, "f").binding;
        }
        get state() {
            return __classPrivateFieldGet(this, _AgentProvider_agent, "f").state;
        }
        static wrap(agent) {
            return wrap(agent, AgentProvider);
        }
        getAgent(sourceIp, sourcePort) {
            return __classPrivateFieldGet(this, _AgentProvider_agent, "f").getAgent(sourceIp, sourcePort);
        }
    }
    _AgentProvider_agent = new WeakMap();
    SafeWrapped.AgentProvider = AgentProvider;
    class AgentPool {
        constructor(pool) {
            _AgentPool_pool.set(this, void 0);
            __classPrivateFieldSet(this, _AgentPool_pool, pool, "f");
        }
        static wrap(pool) {
            return wrap(pool, AgentPool);
        }
        attach(agent) {
            let pool = __classPrivateFieldGet(this, _AgentPool_pool, "f");
            let p = AgentProvider.wrap(agent);
            return pool.attach(p);
        }
        detach(agent) {
            return __classPrivateFieldGet(this, _AgentPool_pool, "f").detach(AgentProvider.wrap(agent));
        }
        detachAll(client) {
            return __classPrivateFieldGet(this, _AgentPool_pool, "f").detachAll(ClientConnection.wrap(client));
        }
        select(domain) {
            return (0, utils_1.promise)(__classPrivateFieldGet(this, _AgentPool_pool, "f").select(domain))
                .then(a => a ? AgentProvider.wrap(a) : false);
        }
        isAvailable(domain) {
            return __classPrivateFieldGet(this, _AgentPool_pool, "f").isAvailable(domain);
        }
    }
    _AgentPool_pool = new WeakMap();
    SafeWrapped.AgentPool = AgentPool;
    class ErrorResponseHandler {
        constructor(handler) {
            _ErrorResponseHandler_handler.set(this, void 0);
            __classPrivateFieldSet(this, _ErrorResponseHandler_handler, handler, "f");
        }
        static wrap(handler) {
            return wrap(handler, ErrorResponseHandler);
        }
        badGateway(request, response) {
            return __classPrivateFieldGet(this, _ErrorResponseHandler_handler, "f").badGateway(request, response);
        }
        serviceUnavailable(request, response) {
            return __classPrivateFieldGet(this, _ErrorResponseHandler_handler, "f").serviceUnavailable(request, response);
        }
        gatewayTimeout(request, response) {
            return __classPrivateFieldGet(this, _ErrorResponseHandler_handler, "f").gatewayTimeout(request, response);
        }
    }
    _ErrorResponseHandler_handler = new WeakMap();
    SafeWrapped.ErrorResponseHandler = ErrorResponseHandler;
})(SafeWrapped = exports.SafeWrapped || (exports.SafeWrapped = {}));

//# sourceMappingURL=wrapper.js.map
