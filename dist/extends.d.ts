/// <reference types="node" />
import { Contracts } from "./contracts";
import { Connection } from "ssh2";
import { Agent } from "http";
import Protocol = Contracts.Protocol;
export declare type ClientConnection = Connection & TraitConnection;
declare class AgentProvider implements Contracts.AgentProvider {
    activeRequests: number;
    readonly binding: string;
    readonly client: ClientConnection;
    readonly protocol: Contracts.Protocol;
    readonly uuid: string;
    private _weight?;
    get weight(): number;
    set weight(weight: number);
    get port(): number;
    getAgent(sourceIp: string, sourcePort: number): Promise<Agent>;
}
declare abstract class TraitConnection implements Contracts.ClientConnection {
    get uuid(): string;
    get agents(): Contracts.AgentProvider[];
    get user(): Contracts.User;
    get bindings(): Map<string, AgentProvider>;
    get console(): Console;
    set console(console: Console);
    get weight(): number;
    set weight(weight: number);
    log(message: string, force?: boolean): Promise<void>;
    setLogging(enable: boolean): void;
    isBound(domain: string, protocol: Contracts.Protocol): boolean;
    setUser(user: Contracts.User): this;
    createAgentProvider(binding: string, protocol: Protocol): AgentProvider;
}
export declare function extendClient(client: Connection): ClientConnection;
export {};
