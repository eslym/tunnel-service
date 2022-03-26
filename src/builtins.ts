import {Contracts} from "./contracts";
import {EventEmitter} from "events";
import * as path from "path";
import * as fs from "fs";
import {PublicKeyAuthContext, utils} from "ssh2";
import {ParsedKey} from "ssh2-streams";
import {timingSafeEqual} from "crypto";
import {DomainMapping} from "./utils";
import {Request, Response} from "express";
import * as util from "util";
import * as https from "https";
import {IncomingMessage} from "http";
import JSON5 = require('json5');
import YAML = require('yaml');
import bcrypt = require('bcrypt');
import UserProvider = Contracts.UserProvider;
import User = Contracts.User;
import Dict = NodeJS.Dict;
import parseKey = utils.parseKey;
import Protocol = Contracts.Protocol;
import AgentProvider = Contracts.AgentProvider;
import AgentPool = Contracts.AgentPool;
import ErrorResponseHandler = Contracts.ErrorResponseHandler;

const ConfigLoader: Dict<(path: string) => Promise<UserConfig>> = {};

async function yamlLoader(path: string) {
    let buff = (await util.promisify(fs.readFile)(path)).toString();
    return YAML.parse(buff);
}

async function jsonLoader(path: string) {
    let buff = (await util.promisify(fs.readFile)(path)).toString();
    return JSON.parse(buff);
}

async function json5Loader(path: string) {
    let buff = (await util.promisify(fs.readFile)(path)).toString();
    return JSON5.parse(buff);
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
    const isMatch = timingSafeEqual(input, allowed);
    return (!autoReject && isMatch);
}

function authKey(context: PublicKeyAuthContext, key: ParsedKey) {
    return context.key.algo === key.type &&
        checkValue(context.key.data, key.getPublicSSH()) &&
        (!context.signature || key.verify(context.blob, context.signature) === true);
}

interface UserConfig {
    keys?: string[],
    domains: string[],
    password?: string,
}

export class FileUserProvider extends EventEmitter implements UserProvider {
    readonly #directory: string;

    constructor(directory: string) {
        super();
        this.#directory = path.resolve(directory);
    }

    async findUser(username: string, client: Contracts.ClientConnection): Promise<Contracts.User | false> {
        for (let ext of Object.keys(ConfigLoader)) {
            let file = path.join(this.#directory, `${username}${ext}`);
            if (!fs.existsSync(file)) {
                continue;
            }
            try {
                await ConfigLoader[ext](file);
                return new FileUser(username, file);
            } catch (e) {
            }
        }
        return undefined;
    }
}

class FileUser implements User {
    readonly username: string;
    readonly #configPath: string;

    constructor(username: string, configPath: string) {
        this.username = username;
        this.#configPath = configPath;
    }

    async authKey(context: PublicKeyAuthContext): Promise<boolean> {
        let config = await this.loadConfig();
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
    }

    authPassword(password: string): Promise<boolean> {
        return this.loadConfig().then((config) => {
            if (!config.hasOwnProperty('password')) {
                return false;
            }
            return bcrypt.compare(password, config.password);
        });
    }

    async canBind(domain: string, protocol: Protocol): Promise<boolean> {
        let config = await this.loadConfig();
        let validator = new DomainMapping<true>();
        for (let pattern of config.domains) {
            validator.addByPattern(pattern, true);
        }
        return validator.resolve(domain).found;
    }

    async loadConfig(): Promise<UserConfig> {
        let ext = path.extname(this.#configPath);
        let config = await ConfigLoader[ext](this.#configPath);
        if (!config.hasOwnProperty('domains')) {
            throw new Error('User domains is required')
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
        if (
            config.hasOwnProperty('keys') &&
            (
                !Array.isArray(config.keys) ||
                config.keys.some(k => typeof k !== 'string')
            )
        ) {
            if (!Array.isArray(config.keys)) {
                throw new Error('Public keys must be an array of string')
            }
        }
        return config;
    }
}

type SelectorFunction = (agents: AgentProvider[]) => AgentProvider | undefined;

export class DefaultAgentPool implements AgentPool {
    readonly #agentSelector: SelectorFunction;
    #agentIndex: Map<string, Map<string, AgentProvider>>
    #domains: DomainMapping<Map<string, AgentProvider>>;

    constructor(selector: SelectorFunction) {
        this.#agentSelector = selector;
        this.#agentIndex = new Map<string, Map<string, Contracts.AgentProvider>>();
        this.#domains = new DomainMapping<Map<string, Contracts.AgentProvider>>();
    }

    attach(agent: Contracts.AgentProvider): void {
        if (!this.#domains.hasPattern(agent.binding)) {
            let map = new Map<string, AgentProvider>();
            map.set(agent.uuid, agent);
            this.#agentIndex.set(agent.uuid, map);
            this.#domains.addByPattern(agent.binding, map);
            return;
        }
        let map = this.#domains.getByPattern(agent.binding);
        map.set(agent.uuid, agent);
        this.#agentIndex.set(agent.uuid, map);
    }

    detach(agent: Contracts.AgentProvider): void {
        let map = this.#agentIndex.get(agent.uuid);
        map.delete(agent.uuid);
        let p = this.#domains.getByPattern(agent.binding);
        if (p && p.size === 0) {
            this.#domains.removePattern(agent.binding);
        }
    }

    detachAll(client: Contracts.ClientConnection): void {
        for (let agent of client.agents) {
            this.detach(agent);
        }
    }

    isAvailable(domain: string): boolean {
        let result = this.#domains.resolve(domain);
        let sample = Array.from(result.value.values())
            .filter(p => p.state === 'active');
        return result.found && sample.length > 0;
    }

    select(domain: string): AgentProvider | false {
        let result = this.#domains.resolve(domain);
        if (!result.found) {
            return false;
        }
        let sample = Array.from(result.value.values())
            .filter(p => p.state === 'active');
        return this.#agentSelector(sample);
    }
}

export class TextPlainErrorResponseHandler implements ErrorResponseHandler {
    badGateway(request: Request, response: Response): Contracts.AsyncResult<void> {
        response.status(502)
            .header('Content-Type', 'text/plain')
            .send('502 Bad Gateway');
    }

    serviceUnavailable(request: Request, response: Response): Contracts.AsyncResult<void> {
        response.status(503)
            .header('Content-Type', 'text/plain')
            .send('503 Service Unavailable');
    }

    gatewayTimeout(request: Request, response: Response): Contracts.AsyncResult<void> {
        response.status(504)
            .header('Content-Type', 'text/plain')
            .send('504 Gateway Timeout');
    }
}

export class HttpCatsErrorResponseHandler implements ErrorResponseHandler {
    handle(status: number) {
        return new Promise<IncomingMessage>((resolve, reject) => {
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

    badGateway(request: Request, response: Response): Promise<void> {
        return this.handle(502).then((incoming) => {
            response.status(502)
                .header('connection', 'close')
                .header('content-type', incoming.headers['content-type'])
                .header('content-length', incoming.headers['content-length'])
                .header('content-disposition', `inline; filename="502 Bad Gateway.jpg"`);
            incoming.pipe(response);
        });
    }

    gatewayTimeout(request: Request, response: Response): Promise<void> {
        return this.handle(504).then((incoming) => {
            response.status(504)
                .header('connection', 'close')
                .header('content-type', incoming.headers['content-type'])
                .header('content-length', incoming.headers['content-length'])
                .header('content-disposition', `inline; filename="504 Gateway Timeout.jpg"`);
            incoming.pipe(response);
        });
    }

    serviceUnavailable(request: Request, response: Response): Promise<void> {
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
