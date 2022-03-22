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
var _TunnelService_instances, _a, _TunnelService_sshServer, _TunnelService_httpServer, _TunnelService_express, _TunnelService_apiRoutes, _TunnelService_httpProxy, _TunnelService_option, _TunnelService_userClients, _TunnelService_proxyOptions, _TunnelService_setupExpress, _TunnelService_setupSSH;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TunnelService = void 0;
const ssh2_1 = require("ssh2");
const express_1 = require("express");
const wrapper_1 = require("./wrapper");
const extends_1 = require("./extends");
const http = require("http");
const console_1 = require("console");
const readline = require("readline");
const commands_1 = require("./commands");
const utils_1 = require("./utils");
const express = require("express");
const HttpProxy = require("http-proxy");
const ip = require("ip");
const net = require("net");
const logger_1 = require("@eslym/logger");
const errors_1 = require("./errors");
class TunnelService {
    constructor(option) {
        _TunnelService_instances.add(this);
        _TunnelService_sshServer.set(this, void 0);
        _TunnelService_httpServer.set(this, void 0);
        _TunnelService_express.set(this, void 0);
        _TunnelService_apiRoutes.set(this, void 0);
        _TunnelService_httpProxy.set(this, void 0);
        _TunnelService_option.set(this, void 0);
        _TunnelService_userClients.set(this, void 0);
        __classPrivateFieldSet(this, _TunnelService_userClients, new Map(), "f");
        __classPrivateFieldSet(this, _TunnelService_option, Object.create(option), "f");
        __classPrivateFieldGet(this, _TunnelService_option, "f").userProvider = wrapper_1.SafeWrapped.UserProvider.wrap(option.userProvider);
        __classPrivateFieldGet(this, _TunnelService_option, "f").agentPool = wrapper_1.SafeWrapped.AgentPool.wrap(option.agentPool);
        __classPrivateFieldGet(this, _TunnelService_option, "f").errorResHandler = wrapper_1.SafeWrapped.ErrorResponseHandler.wrap(option.errorResHandler);
        if (!__classPrivateFieldGet(this, _TunnelService_option, "f").logger) {
            __classPrivateFieldGet(this, _TunnelService_option, "f").logger = logger_1.logger;
        }
        __classPrivateFieldSet(this, _TunnelService_httpProxy, new HttpProxy(), "f");
        __classPrivateFieldSet(this, _TunnelService_apiRoutes, (0, express_1.Router)(), "f");
        __classPrivateFieldSet(this, _TunnelService_sshServer, __classPrivateFieldGet(this, _TunnelService_instances, "m", _TunnelService_setupSSH).call(this), "f");
        __classPrivateFieldSet(this, _TunnelService_express, __classPrivateFieldGet(this, _TunnelService_instances, "m", _TunnelService_setupExpress).call(this), "f");
        __classPrivateFieldSet(this, _TunnelService_httpServer, new http.Server(__classPrivateFieldGet(this, _TunnelService_express, "f")), "f");
        __classPrivateFieldGet(this, _TunnelService_httpServer, "f").on('upgrade', (req, socket, head) => __awaiter(this, void 0, void 0, function* () {
            Object.setPrototypeOf(req, Object.create(__classPrivateFieldGet(this, _TunnelService_express, "f").request));
            const res = () => (0, utils_1.createResponse)(req, __classPrivateFieldGet(this, _TunnelService_express, "f").response, (0, utils_1.mockSocket)(socket));
            try {
                // Check is the hostname is ip address
                if (net.isIP(req.hostname)) {
                    return __classPrivateFieldGet(this, _TunnelService_express, "f").call(this, req, res());
                }
            }
            catch (e) {
            }
            let agent = yield __classPrivateFieldGet(this, _TunnelService_option, "f").agentPool.select(req.hostname);
            if (!agent) {
                return __classPrivateFieldGet(this, _TunnelService_option, "f").errorResHandler.serviceUnavailable(req, res());
            }
            try {
                let options = yield __classPrivateFieldGet(TunnelService, _a, "m", _TunnelService_proxyOptions).call(TunnelService, req, agent);
                let write = socket._write;
                // TODO: Handle the websocket error more properly, might need to make own proxy
                socket._write = (...args) => {
                    socket._write = write;
                    return write.apply(socket, args);
                };
                __classPrivateFieldGet(this, _TunnelService_httpProxy, "f").ws(req, socket, head, options, (err) => {
                    if (socket._write !== write) {
                        if (err instanceof errors_1.TimeoutError) {
                            return __classPrivateFieldGet(this, _TunnelService_option, "f").errorResHandler.gatewayTimeout(req, res());
                        }
                        __classPrivateFieldGet(this, _TunnelService_option, "f").errorResHandler.badGateway(req, res());
                    }
                });
            }
            catch (e) {
                return __classPrivateFieldGet(this, _TunnelService_option, "f").errorResHandler.badGateway(req, res());
            }
        })).on('listening', () => {
            let addr = __classPrivateFieldGet(this, _TunnelService_httpServer, "f").address();
            __classPrivateFieldGet(this, _TunnelService_option, "f").logger.info(`HTTP Server Listening on ${addr.port}`);
        });
    }
    get apiRoutes() {
        return __classPrivateFieldGet(this, _TunnelService_apiRoutes, "f");
    }
    get express() {
        return __classPrivateFieldGet(this, _TunnelService_express, "f");
    }
    get sshServer() {
        return __classPrivateFieldGet(this, _TunnelService_sshServer, "f");
    }
    get httpServer() {
        return __classPrivateFieldGet(this, _TunnelService_httpServer, "f");
    }
    start() {
        __classPrivateFieldGet(this, _TunnelService_option, "f").userProvider.on('user-deactivated', (username) => __awaiter(this, void 0, void 0, function* () {
            if (__classPrivateFieldGet(this, _TunnelService_userClients, "f").has(username)) {
                let clients = __classPrivateFieldGet(this, _TunnelService_userClients, "f").get(username);
                for (let client of clients) {
                    yield __classPrivateFieldGet(this, _TunnelService_option, "f").agentPool.detachAll(client);
                    client.end();
                }
            }
        }));
        __classPrivateFieldGet(this, _TunnelService_httpServer, "f").listen(__classPrivateFieldGet(this, _TunnelService_option, "f").httpPort);
        __classPrivateFieldGet(this, _TunnelService_sshServer, "f").listen(__classPrivateFieldGet(this, _TunnelService_option, "f").sshPort);
    }
}
exports.TunnelService = TunnelService;
_a = TunnelService, _TunnelService_sshServer = new WeakMap(), _TunnelService_httpServer = new WeakMap(), _TunnelService_express = new WeakMap(), _TunnelService_apiRoutes = new WeakMap(), _TunnelService_httpProxy = new WeakMap(), _TunnelService_option = new WeakMap(), _TunnelService_userClients = new WeakMap(), _TunnelService_instances = new WeakSet(), _TunnelService_proxyOptions = function _TunnelService_proxyOptions(req, agent, protocol = 'http') {
    return __awaiter(this, void 0, void 0, function* () {
        let hostPort = req.headers.host.split(':');
        let port = hostPort.length >= 2 ? hostPort[1] : (req.secure ? '443' : '80');
        return {
            target: `${agent.protocol}://${req.hostname}:${port}`,
            headers: {
                'X-Forwarded-For': req.ip,
                'X-Forwarded-Host': req.hostname,
                'X-Forwarded-Proto': protocol + (req.secure ? 's' : ''),
                'X-Forwarded-Port': port,
            },
            agent: yield agent.getAgent(req.socket.remoteAddress, req.socket.remotePort),
            proxyTimeout: undefined,
        };
    });
}, _TunnelService_setupExpress = function _TunnelService_setupExpress() {
    let app = express();
    app.set('trust proxy', __classPrivateFieldGet(this, _TunnelService_option, "f").trustedProxy);
    app.use((req, res, next) => __awaiter(this, void 0, void 0, function* () {
        try {
            // Check is the hostname is ip address
            if (net.isIP(req.hostname)) {
                if (ip.isEqual(req.hostname, req.socket.localAddress)) {
                    // if the hostname is not faked using host header
                    __classPrivateFieldGet(this, _TunnelService_apiRoutes, "f").call(this, req, res, next);
                }
                else {
                    res.status(403)
                        .header('Content-Type', 'text/plain')
                        .send('403 Forbidden');
                }
                return;
            }
        }
        catch (e) {
        }
        let agent = yield __classPrivateFieldGet(this, _TunnelService_option, "f").agentPool.select(req.hostname);
        if (!agent) {
            return __classPrivateFieldGet(this, _TunnelService_option, "f").errorResHandler.serviceUnavailable(req, res);
        }
        try {
            let options = yield __classPrivateFieldGet(TunnelService, _a, "m", _TunnelService_proxyOptions).call(TunnelService, req, agent);
            __classPrivateFieldGet(this, _TunnelService_httpProxy, "f").web(req, res, options, (err) => {
                if (!res.headersSent) {
                    if (err instanceof errors_1.TimeoutError) {
                        return __classPrivateFieldGet(this, _TunnelService_option, "f").errorResHandler.gatewayTimeout(req, res);
                    }
                    return __classPrivateFieldGet(this, _TunnelService_option, "f").errorResHandler.badGateway(req, res);
                }
            });
        }
        catch (e) {
            return __classPrivateFieldGet(this, _TunnelService_option, "f").errorResHandler.badGateway(req, res);
        }
    }));
    __classPrivateFieldGet(this, _TunnelService_apiRoutes, "f").get('/caddy-on-demand-tls', (req, res) => {
        let fail = () => {
            res.status(403)
                .header('Content-Type', 'text/plain')
                .send('403 Forbidden');
        };
        if (typeof req.query.domain !== 'string') {
            return fail();
        }
        if (!__classPrivateFieldGet(this, _TunnelService_option, "f").agentPool.isAvailable(req.query.domain)) {
            return fail();
        }
        res.status(200)
            .header('Content-Type', 'text/plain')
            .send('200 OK');
    });
    return app;
}, _TunnelService_setupSSH = function _TunnelService_setupSSH() {
    return new ssh2_1.Server({
        hostKeys: [__classPrivateFieldGet(this, _TunnelService_option, "f").serverKey],
    }, (connection) => {
        let client = (0, extends_1.extendClient)(connection);
        __classPrivateFieldGet(this, _TunnelService_option, "f").logger.log(`Client ${client.uuid} connected.`);
        client.on('authentication', (context) => __awaiter(this, void 0, void 0, function* () {
            let user = yield (0, utils_1.promise)(__classPrivateFieldGet(this, _TunnelService_option, "f").userProvider.findUser(context.username, client))
                .catch(e => __classPrivateFieldGet(this, _TunnelService_option, "f").logger.error(e));
            if (!user) {
                return context.reject();
            }
            let authenticated = false;
            switch (context.method) {
                case "password":
                    authenticated = yield user.authPassword(context.password);
                    break;
                case "publickey":
                    authenticated = yield user.authKey(context);
                    break;
            }
            if (authenticated) {
                __classPrivateFieldGet(this, _TunnelService_option, "f").logger.log(`${client.uuid} authenticated as ${context.username} using ${context.method}`);
                client.setUser(wrapper_1.SafeWrapped.User.wrap(user));
                client.authenticatedContext = context;
                if (!__classPrivateFieldGet(this, _TunnelService_userClients, "f").has(user.username)) {
                    __classPrivateFieldGet(this, _TunnelService_userClients, "f").set(user.username, new Set());
                }
                __classPrivateFieldGet(this, _TunnelService_userClients, "f").get(user.username).add(client);
                return context.accept();
            }
            context.reject();
        })).on('request', (accept, reject, type, info) => __awaiter(this, void 0, void 0, function* () {
            try {
                switch (type) {
                    case "tcpip-forward":
                        __classPrivateFieldGet(this, _TunnelService_option, "f").logger.log(`${client.uuid} trying to bind ${info.bindAddr}`);
                        if (client.bindings.has(info.bindAddr)) {
                            client.log(`Client already bounded to ${info.bindAddr}`, true).catch();
                            return reject();
                        }
                        if (![80, 443].includes(info.bindPort)) {
                            client.log(`Only port 80 and 443 are allowed.`, true).catch();
                            return reject();
                        }
                        let protocol = info.bindPort === 80 ? 'http' : 'https';
                        if (!(yield client.user.canBind(info.bindAddr, protocol))) {
                            client.log(`The current user is not allowed to bind to ${info.bindAddr}:${info.bindPort}`, true).catch();
                            return reject();
                        }
                        let provider = client.createAgentProvider(info.bindAddr, protocol, __classPrivateFieldGet(this, _TunnelService_option, "f").proxyTimeout);
                        return (0, utils_1.promise)(__classPrivateFieldGet(this, _TunnelService_option, "f").agentPool.attach(provider))
                            .then(() => {
                            client.log(`Bounded to ${info.bindAddr}:${info.bindPort}`, true).catch();
                            client.bindings.set(info.bindAddr, provider);
                            __classPrivateFieldGet(this, _TunnelService_option, "f").logger.log(`${client.uuid} bounded to ${info.bindAddr}`);
                            return accept();
                        })
                            .catch((e) => {
                            client.log(`Unable to bind to ${info.bindAddr}:${info.bindPort}`, true).catch();
                            __classPrivateFieldGet(this, _TunnelService_option, "f").logger.error(e);
                            reject();
                        });
                    case "cancel-tcpip-forward":
                        if (client.bindings.has(info.bindAddr)) {
                            let provider = client.bindings.get(info.bindAddr);
                            let port = provider.protocol === 'http' ? 80 : 443;
                            if (port !== info.bindPort) {
                                client.log(`The current client is not bounded to ${info.bindAddr}:${info.bindPort}`, true).catch();
                                return reject();
                            }
                            __classPrivateFieldGet(this, _TunnelService_option, "f").agentPool.detach(provider);
                            client.log(`Unbound from ${info.bindAddr}:${info.bindPort}`, true).catch();
                            return accept();
                        }
                        client.log(`The current client is not bounded to ${info.bindAddr}:${info.bindPort}`, true).catch();
                        return reject();
                }
                reject();
            }
            catch (e) {
                reject();
            }
        })).on('session', ((accept) => {
            let session = accept();
            session.on('exec', (accept, reject, info) => {
                let channel = accept();
                let con = new console_1.Console(channel.stdout, channel.stderr);
                let mainSession = false;
                if (!client.console) {
                    client.console = con;
                    channel.on('close', () => {
                        client.end();
                    });
                    mainSession = true;
                }
                commands_1.commands.parse(info.command, { client, console: con }, (err, argv, output) => {
                    if (output.length) {
                        con.error(output);
                    }
                    if (!mainSession) {
                        channel.exit(0);
                        channel.end();
                    }
                });
            }).on('shell', (accept) => {
                let channel = accept();
                let con = new console_1.Console(channel.stdout, channel.stderr);
                if (!client.console) {
                    client.console = con;
                    channel.on('close', () => {
                        client.end();
                    });
                }
                let rl = readline.createInterface(channel.stdin, channel.stdout);
                rl.on('line', (line) => {
                    rl.pause();
                    commands_1.commands.parse(line, { client, console: con }, (err, argv, output) => {
                        if (output !== '') {
                            con.error(output);
                        }
                        rl.resume();
                    });
                });
            });
        })).on('close', () => {
            __classPrivateFieldGet(this, _TunnelService_option, "f").agentPool.detachAll(client);
            __classPrivateFieldGet(this, _TunnelService_option, "f").logger.log(`${client.uuid} disconnected.`);
            __classPrivateFieldGet(this, _TunnelService_userClients, "f").get(client.user.username).delete(client);
        });
    }).on('listening', () => {
        let addr = __classPrivateFieldGet(this, _TunnelService_sshServer, "f").address();
        __classPrivateFieldGet(this, _TunnelService_option, "f").logger.info(`SSH Server Listening on ${addr.port}`);
    });
};

//# sourceMappingURL=service.js.map
