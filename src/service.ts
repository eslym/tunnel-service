import {EncryptedPrivateKey, Server} from "ssh2";
import {Buffer} from "buffer";
import {Contracts} from "./contracts";
import {Express, NextFunction, Request, Response, Router} from "express";
import {SafeWrapped} from "./wrapper";
import {ServerOptions as ProxyOption} from "http-proxy";
import {ClientConnection, extendClient} from "./extends";
import * as http from "http";
import {Console} from "console";
import * as readline from "readline";
import {commands} from "./commands";
import {createResponse, mockSocket, promise} from "./utils";
import * as net from "net";
import {logger, Logger} from "@eslym/logger";
import {TimeoutError} from "./errors";
import express = require('express');
import HttpProxy = require('http-proxy');
import ip = require('ip');
import finalhandler = require("finalhandler");
import UserProvider = Contracts.UserProvider;
import AgentPool = Contracts.AgentPool;
import AgentProvider = Contracts.AgentProvider;
import ErrorResponseHandler = Contracts.ErrorResponseHandler;
import Protocol = Contracts.Protocol;
import Guard = Contracts.Guard;

export interface LaunchOption {
    httpPort: number;
    sshPort: number;
    serverKey: Buffer | string | EncryptedPrivateKey;
    userProvider: UserProvider;
    agentPool: AgentPool;
    errorResHandler: ErrorResponseHandler;
    trustedProxy?: string | false;
    proxyTimeout?: number;
    logger?: Logger;
}

export class TunnelService {
    readonly #sshServer: Server;
    readonly #httpServer: http.Server;
    readonly #express: Express;
    readonly #apiRoutes: Router;
    readonly #guards: Set<Contracts.Guard>;
    #httpProxy: HttpProxy;
    #option: LaunchOption;
    #userClients: Map<string, Set<ClientConnection>>;

    constructor(option: LaunchOption) {
        this.#userClients = new Map<string, Set<ClientConnection>>();
        this.#guards = new Set<Contracts.Guard>();
        this.#option = Object.create(option);
        this.#option.userProvider = SafeWrapped.UserProvider.wrap(option.userProvider);
        this.#option.agentPool = SafeWrapped.AgentPool.wrap(option.agentPool);
        this.#option.errorResHandler = SafeWrapped.ErrorResponseHandler.wrap(option.errorResHandler);
        if (!this.#option.logger) {
            this.#option.logger = logger;
        }
        this.#httpProxy = new HttpProxy();
        this.#apiRoutes = Router();
        this.#sshServer = this.#setupSSH();
        this.#express = this.#setupExpress();
        this.#httpServer = new http.Server(this.#express);
        this.#httpServer.on('upgrade', (req: Request, socket, head) => {
            socket.on('error', (err) => {
                this.#option.logger.error(`Error on outgoing response, ${err.message}`);
            });
            Object.setPrototypeOf(req, Object.create(this.#express.request));
            let response = createResponse(req, this.#express.response, mockSocket(socket));
            let write = socket._write;
            // TODO: Handle the websocket error more properly, might need to make own proxy
            Object.defineProperty(response, 'headerSent', {
                get() {
                    return socket._write === write;
                }
            })
            socket._write = (...args) => {
                socket._write = write;
                return write.apply(socket, args);
            }
            let next = (err?: any) => {
                finalhandler(req, response, {
                    env: this.#express.get('env')
                })(err);
            }
            return this.#handleRequest(req, response, next, (options, onError) => {
                this.#httpProxy.ws(req, socket, head, options, onError);
            });
        }).on('listening', () => {
            let addr = this.#httpServer.address() as any;
            this.#option.logger.info(`HTTP Server Listening on ${addr.port}`);
        });
    }

    get apiRoutes() {
        return this.#apiRoutes;
    }

    get express() {
        return this.#express;
    }

    get sshServer() {
        return this.#sshServer;
    }

    get httpServer() {
        return this.#httpServer;
    }

    get guards() {
        return this.#guards;
    }

    static async #proxyOptions(req: Request, agent: AgentProvider): Promise<ProxyOption> {
        let hostPort = req.headers.host.split(':');
        let port = hostPort.length >= 2 ? hostPort[1] : (req.secure ? '443' : '80');
        return {
            target: `${agent.protocol}://${req.hostname}:${port}`,
            headers: {
                'X-Forwarded-For': req.ip,
                'X-Forwarded-Host': req.hostname,
                // X-Forwarded-Proto should only use http and https,
                // see https://github.com/traefik/traefik/issues/6388
                'X-Forwarded-Proto': req.secure ? 'https' : 'http',
                'X-Forwarded-Port': port,
            },
            agent: await agent.getAgent(req.socket.remoteAddress, req.socket.remotePort),
            proxyTimeout: undefined,
        }
    }

    start() {
        this.#option.userProvider.on('user-deactivated', async (username) => {
            if (this.#userClients.has(username)) {
                let clients = this.#userClients.get(username);
                for (let client of clients) {
                    await this.#option.agentPool.detachAll(client);
                    client.end();
                }
            }
        });
        this.#httpServer.listen(this.#option.httpPort);
        this.#sshServer.listen(this.#option.sshPort);
    }

    #setupExpress() {
        let app = express();

        app.disable('x-powered-by');

        app.set('trust proxy', this.#option.trustedProxy);

        app.use((req, res, next) => {
            return this.#handleRequest(req, res, next, (options, onError) => {
                this.#httpProxy.web(req, res, options, onError);
            });
        });

        this.#apiRoutes.get('/caddy-on-demand-tls', (req, res) => {
            let fail = () => {
                res.status(403)
                    .header('Content-Type', 'text/plain')
                    .send('403 Forbidden');
            }
            if (typeof req.query.domain !== 'string') {
                return fail();
            }
            if (!this.#option.agentPool.isAvailable(req.query.domain)) {
                return fail();
            }
            res.status(200)
                .header('Content-Type', 'text/plain')
                .send('200 OK');
        });

        return app;
    }

    #setupSSH(): Server {
        return new Server({
            hostKeys: [this.#option.serverKey],
        }, (connection) => {
            let client = extendClient(connection);
            this.#option.logger.log(`Client ${client.uuid} connected.`);
            let dropClient = () => {
                this.#option.agentPool.detachAll(client);
                this.#option.logger.log(`${client.uuid} disconnected.`);
                this.#userClients.get(client.user.username).delete(client);
                for (let agent of client.bindings.values()) {
                    for (let ch of agent.activeChannels) {
                        ch.close();
                    }
                }
            };
            client.on('authentication', async (context) => {
                let user = await promise(this.#option.userProvider.findUser(context.username, client))
                    .catch(e => this.#option.logger.error(e));
                if (!user) {
                    return context.reject();
                }
                let authenticated = false;
                switch (context.method) {
                    case "password":
                        authenticated = await user.authPassword(context.password);
                        break;
                    case "publickey":
                        authenticated = await user.authKey(context);
                        break;
                }
                if (authenticated) {
                    this.#option.logger.log(`${client.uuid} authenticated as ${context.username} using ${context.method}`);
                    client.setUser(SafeWrapped.User.wrap(user));
                    client.authenticatedContext = context;
                    if (!this.#userClients.has(user.username)) {
                        this.#userClients.set(user.username, new Set<ClientConnection>());
                    }
                    this.#userClients.get(user.username).add(client);
                    return context.accept();
                }
                context.reject();
            }).on('request', async (accept, reject, type, info) => {
                try {
                    switch (type) {
                        case "tcpip-forward":
                            this.#option.logger.log(`${client.uuid} trying to bind ${info.bindAddr}`);
                            if (client.bindings.has(info.bindAddr)) {
                                client.log(`Client already bounded to ${info.bindAddr}`, true).catch();
                                return reject();
                            }
                            if (![80, 443].includes(info.bindPort)) {
                                client.log(`Only port 80 and 443 are allowed.`, true).catch();
                                return reject();
                            }
                            let protocol: Protocol = info.bindPort === 80 ? 'http' : 'https';
                            if (!await client.user.canBind(info.bindAddr, protocol)) {
                                client.log(`The current user is not allowed to bind to ${info.bindAddr}:${info.bindPort}`, true).catch();
                                return reject();
                            }
                            let provider = client.createAgentProvider(info.bindAddr, protocol, this.#option.proxyTimeout);
                            return promise(this.#option.agentPool.attach(provider))
                                .then(() => {
                                    client.log(`Bounded to ${info.bindAddr}:${info.bindPort}`, true).catch();
                                    client.bindings.set(info.bindAddr, provider);
                                    this.#option.logger.log(`${client.uuid} bounded to ${info.bindAddr}`);
                                    return accept();
                                })
                                .catch((e) => {
                                    client.log(`Unable to bind to ${info.bindAddr}:${info.bindPort}`, true).catch();
                                    this.#option.logger.error(e);
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
                                this.#option.agentPool.detach(provider);
                                client.log(`Unbound from ${info.bindAddr}:${info.bindPort}`, true).catch();
                                return accept();
                            }
                            client.log(`The current client is not bounded to ${info.bindAddr}:${info.bindPort}`, true).catch();
                            return reject();
                    }
                    reject();
                } catch (e) {
                    reject();
                }
            }).on('session', ((accept) => {
                let session = accept();
                session.on('exec', (accept, reject, info) => {
                    let channel = accept();
                    let con = new Console(channel.stdout, channel.stderr);
                    let mainSession = false;
                    if (!client.console) {
                        client.console = con;
                        channel.on('close', () => {
                            client.end();
                        });
                        mainSession = true;
                    }
                    commands.parse(info.command, {client, console: con}, (err, argv, output) => {
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
                    let con = new Console(channel.stdout, channel.stderr);
                    if (!client.console) {
                        client.console = con;
                        channel.on('close', () => {
                            client.end();
                        });
                    }
                    let rl = readline.createInterface(channel.stdin, channel.stdout);
                    rl.on('line', (line) => {
                        rl.pause();
                        commands.parse(line, {client, console: con}, (err, argv, output) => {
                            if (output !== '') {
                                con.error(output);
                            }
                            rl.resume();
                        });
                    });
                });
            })).on('close', dropClient)
                .on('error', (err: Error) => {
                    logger.error(`Client error: ${err.message}`);
                    dropClient();
                })
        }).on('listening', () => {
            let addr = this.#sshServer.address();
            this.#option.logger.info(`SSH Server Listening on ${addr.port}`);
        });
    }

    #handleRequest(
        request: Request,
        response: Response,
        next: NextFunction,
        callback: (options: ProxyOption, onError: (error?: Error) => unknown) => unknown
    ) {
        try {
            // Check is the hostname is ip address
            if (net.isIP(request.hostname)) {
                if (ip.isEqual(request.hostname, request.socket.localAddress)) {
                    // if the hostname is not faked using host header
                    this.#apiRoutes(request, response, next);
                } else {
                    response.status(403)
                        .header('Content-Type', 'text/plain')
                        .send('403 Forbidden');
                }
                return;
            }
        } catch (e) {
        }
        let guards = this.#guards[Symbol.iterator]();
        let current;
        let nextFunc = async (error?: any) => {
            if (error) next(error);
            current = guards.next();
            if (!current.done) {
                return (current.value as Guard)(request, response, nextFunc);
            }
            let agent = await this.#option.agentPool.select(request.hostname);
            if (!agent) {
                return this.#option.errorResHandler.serviceUnavailable(request, response);
            }
            try {
                let options = await TunnelService.#proxyOptions(request, agent);
                callback(options, (err) => {
                    if (!response.headersSent) {
                        if (err instanceof TimeoutError) {
                            return this.#option.errorResHandler.gatewayTimeout(request, response);
                        }
                        this.#option.errorResHandler.badGateway(request, response);
                    }
                });
            } catch (e) {
                return this.#option.errorResHandler.badGateway(request, response);
            }
        }
        nextFunc().catch(next);
    }
}
