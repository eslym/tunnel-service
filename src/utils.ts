import {Contracts} from "./contracts";
import * as punycode from "punycode";
import {Duplex} from "stream";
import {Socket} from "net";
import {Request, Response} from "express";
import {ServerResponse} from "http";
import AsyncResult = Contracts.AsyncResult;
import AgentProvider = Contracts.AgentProvider;

export async function promise<T>(value: AsyncResult<T>): Promise<T> {
    return value;
}

function calPriority(agent: AgentProvider, criteria: number) {
    return criteria / agent.weight;
}

export function selectRandomly(agents: AgentProvider[]): AgentProvider {
    if (agents.length === 0) {
        return undefined;
    }

    let bias = new Map<AgentProvider, number>();

    function getBias(agent) {
        if (!bias.has(agent)) {
            bias.set(agent, Math.random());
        }
        return bias.get(agent);
    }

    return agents.sort(
        (a, b) =>
            calPriority(a, getBias(a)) -
            calPriority(b, getBias(b))
    )[0];
}

export function selectLessRequest(agents: AgentProvider[]): AgentProvider {
    if (agents.length === 0) {
        return undefined;
    }

    let bias = new Map<AgentProvider, number>();

    function getBias(agent) {
        if (!bias.has(agent)) {
            bias.set(agent, Math.random());
        }
        return bias.get(agent);
    }

    let sorted = agents.sort(
        (a, b) => {
            let res = calPriority(a, a.activeRequests) -
                calPriority(b, b.activeRequests);
            return res === 0 ? getBias(a) - getBias(b) : res;
        }
    );

    return sorted[0];
}

interface MatchingResult<T> {
    value?: T,
    found: boolean,
}

function validatePattern(pattern: string) {
    let parts = pattern.split('.')
        .map(punycode.toASCII);
    let invalid = parts
        .filter(p => !['*', '**'].includes(p))
        .some(p => !p.length || /[^a-z0-9-_]/i.test(p));
    if (invalid || /\.\*\*/.test(pattern)) {
        throw new Error('Invalid domain pattern');
    }
}

export class DomainMapping<T> {
    #mapping: Map<string, T> = new Map();

    resolve(domain: string): MatchingResult<T> {
        return this.#resolve(domain.split('.'), []);
    }

    getByPattern(pattern: string): T {
        return this.#mapping.get(pattern);
    }

    hasPattern(pattern: string): boolean {
        return this.#mapping.has(pattern);
    }

    addByPattern(pattern: string, value: T): this {
        validatePattern(pattern);
        this.#mapping.set(pattern, value);
        return this;
    }

    removePattern(pattern: string): this {
        validatePattern(pattern);
        this.#mapping.delete(pattern);
        return this;
    }

    #resolve(left: string[], right: string[]): MatchingResult<T> {
        let subject = right.join('.');
        if (left.length === 0) {
            return {
                value: this.#mapping.get(subject),
                found: this.#mapping.has(subject),
            }
        }
        let sub = left.pop();
        if (sub === '**') {
            // When doing pattern matching, catch all should match only with catch all
            return this.#resolve([], ['**'].concat(right));
        }
        let res = this.#resolve(Array.from(left), [sub].concat(right));
        if (!res.found) {
            res = this.#resolve(Array.from(left), ['*'].concat(right));
        }
        if (!res.found) {
            res = this.#resolve([], ['**'].concat(right));
        }
        return res;
    }
}

export async function wait(milliseconds: number) {
    return new Promise((res) => setTimeout(res, milliseconds));
}

const nothing = () => undefined;

export function mockSocket(stream: Duplex) {
    if (stream instanceof Socket) {
        return stream;
    }
    let sock = stream as any as Socket;
    sock.setKeepAlive = nothing;
    sock.setNoDelay = nothing;
    sock.setTimeout = nothing;
    sock.ref = nothing;
    sock.unref = nothing;
    return sock;
}

export function createResponse(req: Request, type: Response, socket: Socket) {
    if (typeof req.res !== 'undefined') {
        return req.res;
    }
    let res = new ServerResponse(req);
    res.assignSocket(mockSocket(socket));
    Object.setPrototypeOf(res, Object.create(type));
    req.res = res as Response;
    return req.res;
}
