/// <reference types="node" />
import { Contracts } from "./contracts";
import { EventEmitter } from "events";
import { Request, Response } from "express";
import { IncomingMessage } from "http";
import UserProvider = Contracts.UserProvider;
import AgentProvider = Contracts.AgentProvider;
import AgentPool = Contracts.AgentPool;
import ErrorResponseHandler = Contracts.ErrorResponseHandler;
export declare class FileUserProvider extends EventEmitter implements UserProvider {
    #private;
    constructor(directory: string);
    findUser(username: string, client: Contracts.ClientConnection): Promise<Contracts.User | false>;
}
declare type SelectorFunction = (agents: AgentProvider[]) => AgentProvider | undefined;
export declare class DefaultAgentPool implements AgentPool {
    #private;
    constructor(selector: SelectorFunction);
    attach(agent: Contracts.AgentProvider): void;
    detach(agent: Contracts.AgentProvider): void;
    detachAll(client: Contracts.ClientConnection): void;
    isAvailable(domain: string): boolean;
    select(domain: string): AgentProvider | false;
}
export declare class TextPlainErrorResponseHandler implements ErrorResponseHandler {
    badGateway(request: Request, response: Response): Contracts.AsyncResult<void>;
    serviceUnavailable(request: Request, response: Response): Contracts.AsyncResult<void>;
    gatewayTimeout(request: Request, response: Response): Contracts.AsyncResult<void>;
}
export declare class HttpCatsErrorResponseHandler implements ErrorResponseHandler {
    handle(status: number): Promise<IncomingMessage>;
    badGateway(request: Request, response: Response): Promise<void>;
    gatewayTimeout(request: Request, response: Response): Promise<void>;
    serviceUnavailable(request: Request, response: Response): Promise<void>;
}
export {};
