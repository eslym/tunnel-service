/// <reference types="node" />
import { EncryptedPrivateKey, Server } from "ssh2";
import { Buffer } from "buffer";
import { Contracts } from "./contracts";
import { Express, Router } from "express";
import * as http from "http";
import UserProvider = Contracts.UserProvider;
import AgentPool = Contracts.AgentPool;
import ErrorResponseHandler = Contracts.ErrorResponseHandler;
import { Logger } from "@eslym/logger";
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
    get apiRoutes(): Router;
    get express(): Express;
    get sshServer(): Server;
    get httpServer(): http.Server;
    constructor(option: LaunchOption);
    start(): void;
}
