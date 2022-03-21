import {PublicKeyAuthContext} from "ssh2";
import {Agent} from "http";
import Dict = NodeJS.Dict;
import {Request, Response} from 'express';

/**
 * API for customization.
 */
export namespace Contracts {

    export type AsyncResult<T> = Promise<T> | T;
    export type Protocol = 'http' | 'https';

    export interface Emitter<T extends Dict<(...args: any[])=>void>> {
        on<E extends keyof T>(event: E, listener: T[E]): this;
        once<E extends keyof T>(event: E, listener: T[E]): this;
        off<E extends keyof T>(event: E, listener: T[E]): this;
    }

    /**
     * User interface for authorization
     */
    export interface User {
        /**
         * The username of user.
         */
        readonly username: string;

        /**
         * Authorize user with password
         * @param password The password
         * @return true if user can be authenticated by the given password.
         */
        authPassword(password: string): AsyncResult<boolean>;

        /**
         * Authorize user with key
         * @param context A SSH2 PublicKeyAuthContext
         * @return true if user can be authenticated by the given key.
         */
        authKey(context: PublicKeyAuthContext): AsyncResult<boolean>;

        /**
         * Check the user can serve the provided domain
         * @param domain the domain
         * @param protocol the protocol which the local client serving
         * @return true if user can bind to the domain
         */
        canBind(domain: string, protocol: Protocol): AsyncResult<boolean>;
    }

    /**
     * SSH client connection
     */
    export interface ClientConnection {
        /**
         * UUID of the connection
         */
        readonly uuid: string;

        /**
         * User of the connection
         */
        readonly user?: User;

        /**
         * HTTP Agents
         */
        readonly agents: AgentProvider[];

        /**
         * Count of active request in this client is handling
         */
        readonly activeRequests: number,

        /**
         * The state of the client connection
         */
        readonly state: 'active' | 'pausing' | 'shutting-down';

        /**
         * Message to log to SSH client, not recommend using
         * @param message the message
         * @param force true to force write the log to client even logging is not enabled
         */
        log(message: string, force?: boolean): AsyncResult<void>;

        isBound(domain: string, protocol: Protocol): boolean;
    }

    /**
     * The interface which provide user
     */
    export interface UserProvider extends Emitter<{
        'user-deactivated': (username: string)=>void;
    }>
    {
        /**
         * Find user by username
         * @param username the username
         * @param client extra info
         * @return the user or false when the user is not exists
         */
        findUser(username: string, client: ClientConnection): AsyncResult<User | false>;
    }

    /**
     * Provider of http agent
     */
    export interface AgentProvider {
        /**
         * ID of the agent,
         */
        readonly uuid: string;

        /**
         * The client of this agent
         */
        readonly client: ClientConnection,

        /**
         * Which protocol this agent is using
         */
        readonly protocol: Protocol,

        /**
         * Weight for load balancing
         */
        readonly weight: number,

        /**
         * Count of active request in this agent is handling
         */
        readonly activeRequests: number,

        /**
         * The domain which this agent bound to, might be wildcard
         */
        readonly binding: string,

        /**
         * The state of the provider
         */
        readonly state: 'active' | 'pausing' | 'shutting-down';

        /**
         * Get the agent from this provider
         */
        getAgent(sourceIp: string, sourcePort: number): AsyncResult<Agent>;
    }

    /**
     * The pool of http agents for reverse proxy.
     * Whoever implement this interface will need to handle the wildcard domain binding and load balancing
     */
    export interface AgentPool {
        /**
         * Attach the http agent into the pool
         * @param agent the agent to add to pool
         */
        attach(agent: AgentProvider): AsyncResult<void>;

        /**
         * Remove the http agent from the pool
         * @param agent the agent to remove from pool
         */
        detach(agent: AgentProvider): AsyncResult<void>;

        /**
         * Detach all agent from same client
         * @param client the client
         */
        detachAll(client: ClientConnection): AsyncResult<void>;

        /**
         * Select an agent from this pool to handle the request.
         * @param domain The domain which receiving request.
         * @return the agent when found any, false if service unavailable
         */
        select(domain: string): AsyncResult<AgentProvider | false>;

        /**
         * Check if the domain is available
         * @param domain the domain
         * @return true when domain is available
         */
        isAvailable(domain: string): AsyncResult<boolean>;
    }

    /**
     * Handler to handle error response
     */
    export interface ErrorResponseHandler {
        /**
         * Handle the response when the proxy request is having error
         * @param request
         * @param response
         */
        badGateway(request: Request, response: Response): AsyncResult<void>;

        /**
         * Handle the response when there is no agent to handle the incoming request
         * @param request
         * @param response
         */
        serviceUnavailable(request: Request, response: Response): AsyncResult<void>;

        /**
         * Handle the response when proxy timeout.
         * @param request
         * @param response
         */
        gatewayTimeout(request: Request, response: Response): AsyncResult<void>;
    }
}
