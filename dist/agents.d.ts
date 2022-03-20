/// <reference types="node" />
import { Agent, AgentOptions } from "http";
import { ServerChannel } from "ssh2";
import { ClientConnection } from "./extends";
import * as https from "https";
interface BindingInfo {
    activeRequests: number;
}
export declare class HttpAgent extends Agent {
    #private;
    constructor(channel: ServerChannel, client: ClientConnection, info: BindingInfo, options: AgentOptions);
    createConnection(options: AgentOptions, callback: (err: any, stream: any) => void): void;
}
export declare class HttpsAgent extends https.Agent {
    #private;
    constructor(channel: ServerChannel, client: ClientConnection, info: BindingInfo, options: AgentOptions);
    createConnection(options: AgentOptions, callback: (err: any, stream: any) => void): void;
}
export {};
