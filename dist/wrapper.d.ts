/// <reference types="node" />
import { Contracts } from "./contracts";
import { AuthContext, PublicKeyAuthContext } from "ssh2";
import { Agent } from "http";
import { Request, Response } from "express";
/**
 * SafeWrapped Namespace
 *
 * Wrap contracts object and only expose the API
 */
export declare namespace SafeWrapped {
    import P = Contracts.AsyncResult;
    import Protocol = Contracts.Protocol;
    class User implements Contracts.User {
        #private;
        constructor(user: Contracts.User);
        get username(): string;
        static wrap(user?: Contracts.User): any;
        authKey(context: PublicKeyAuthContext): P<boolean>;
        authPassword(password: string): P<boolean>;
        canBind(domain: string, protocol: Protocol): P<boolean>;
    }
    class ClientConnection implements Contracts.ClientConnection {
        #private;
        constructor(client: Contracts.ClientConnection);
        get uuid(): string;
        get user(): Contracts.User;
        get authenticatedContext(): AuthContext;
        get agents(): Contracts.AgentProvider[];
        get activeRequests(): number;
        get state(): 'active' | 'pausing' | 'shutting-down';
        static wrap(client?: Contracts.ClientConnection): any;
        log(message: string, force?: boolean): Contracts.AsyncResult<void>;
        isBound(domain: string, protocol: Contracts.Protocol): boolean;
    }
    class UserProvider implements Contracts.UserProvider {
        #private;
        constructor(provider: Contracts.UserProvider);
        static wrap(provider?: Contracts.UserProvider): any;
        findUser(username: string, client: Contracts.ClientConnection): Contracts.AsyncResult<Contracts.User | false>;
        off(event: 'user-deactivated', listener: (username: string) => void): this;
        on(event: 'user-deactivated', listener: (username: string) => void): this;
        once(event: 'user-deactivated', listener: (username: string) => void): this;
    }
    class AgentProvider implements Contracts.AgentProvider {
        #private;
        constructor(agent: Contracts.AgentProvider);
        get uuid(): string;
        get client(): Contracts.ClientConnection;
        get protocol(): Contracts.Protocol;
        get weight(): number;
        get activeRequests(): number;
        get binding(): string;
        get state(): 'active' | 'pausing' | 'shutting-down';
        static wrap(agent: Contracts.AgentProvider): any;
        getAgent(sourceIp: string, sourcePort: number): Contracts.AsyncResult<Agent>;
    }
    class AgentPool implements Contracts.AgentPool {
        #private;
        constructor(pool: Contracts.AgentPool);
        static wrap(pool: Contracts.AgentPool): any;
        attach(agent: Contracts.AgentProvider): Contracts.AsyncResult<void>;
        detach(agent: Contracts.AgentProvider): Contracts.AsyncResult<void>;
        detachAll(client: Contracts.ClientConnection): Contracts.AsyncResult<void>;
        select(domain: string): Contracts.AsyncResult<Contracts.AgentProvider | false>;
        isAvailable(domain: string): Contracts.AsyncResult<boolean>;
    }
    class ErrorResponseHandler implements Contracts.ErrorResponseHandler {
        #private;
        constructor(handler: Contracts.ErrorResponseHandler);
        static wrap(handler: Contracts.ErrorResponseHandler): any;
        badGateway(request: Request, response: Response): Contracts.AsyncResult<void>;
        serviceUnavailable(request: Request, response: Response): Contracts.AsyncResult<void>;
        gatewayTimeout(request: Request, response: Response): Contracts.AsyncResult<void>;
    }
}
