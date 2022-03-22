/// <reference types="node" />
import { EncryptedPrivateKey, Server } from "ssh2";
import { Buffer } from "buffer";
import { Contracts } from "./contracts";
import { Express, Router } from "express";
import * as http from "http";
import { Logger } from "@eslym/logger";
import UserProvider = Contracts.UserProvider;
import AgentPool = Contracts.AgentPool;
import ErrorResponseHandler = Contracts.ErrorResponseHandler;
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
export declare class TunnelService {
    #private;
    constructor(option: LaunchOption);
    get apiRoutes(): Router;
    get express(): Express;
    get sshServer(): Server;
    get httpServer(): http.Server;
    get guards(): Set<Contracts.Guard>;
    start(): void;
}
