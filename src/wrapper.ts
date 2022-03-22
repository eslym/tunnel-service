import {Contracts} from "./contracts";
import {AuthContext, PublicKeyAuthContext} from "ssh2";
import {promise} from "./utils";
import {Agent} from "http";
import {Request, Response} from "express";

const wrapped = new WeakMap();

function wrap<T>(target: any, type: new (v: any)=>T){
    if(typeof target !== 'object'){
        return target
    }
    if(target instanceof type){
        return target;
    }
    if(!wrapped.has(target)){
        wrapped.set(target, new type(target));
    }
    return wrapped.get(target);
}

/**
 * SafeWrapped Namespace
 *
 * Wrap contracts object and only expose the API
 */
export namespace SafeWrapped {
    import P = Contracts.AsyncResult;
    import Protocol = Contracts.Protocol;

    export class User implements Contracts.User{
        readonly #user: Contracts.User;

        constructor(user: Contracts.User) {
            this.#user = user;
        }

        get username(): string {
            return this.#user.username;
        }

        authKey(context: PublicKeyAuthContext): P<boolean> {
            return this.#user.authKey(context);
        }

        authPassword(password: string): P<boolean> {
            return this.#user.authPassword(password);
        }

        canBind(domain: string, protocol: Protocol): P<boolean> {
            return this.#user.canBind(domain, protocol);
        }

        static wrap(user?: Contracts.User){
            return wrap(user, User);
        }
    }

    export class ClientConnection implements Contracts.ClientConnection{
        readonly #client: Contracts.ClientConnection;

        constructor(client: Contracts.ClientConnection) {
            this.#client = client;
        }

        get uuid(): string {
            return this.#client.uuid;
        }

        get user(): Contracts.User {
            return User.wrap(this.#client.user);
        }

        get authenticatedContext(): AuthContext{
            return this.#client.authenticatedContext;
        }

        get agents(): Contracts.AgentProvider[] {
            return this.#client.agents.map(AgentProvider.wrap);
        }

        get activeRequests(): number {
            return this.#client.activeRequests;
        }

        get state(): 'active' | 'pausing' | 'shutting-down'{
            return this.#client.state;
        }

        log(message: string, force?: boolean): Contracts.AsyncResult<void> {
            return this.#client.log(message, force);
        }

        isBound(domain: string, protocol: Contracts.Protocol): boolean {
            return this.#client.isBound(domain, protocol);
        }

        static wrap(client?: Contracts.ClientConnection){
            return wrap(client, ClientConnection);
        }
    }

    export class UserProvider implements Contracts.UserProvider {
        readonly #provider: Contracts.UserProvider;

        constructor(provider: Contracts.UserProvider) {
            this.#provider = provider;
        }

        findUser(username: string, client: Contracts.ClientConnection): Contracts.AsyncResult<Contracts.User | false> {
            return promise(this.#provider.findUser(username, client)).then(User.wrap);
        }

        off(event: 'user-deactivated', listener: (username: string)=>void): this {
            this.#provider.off(event, listener);
            return this;
        }

        on(event: 'user-deactivated', listener: (username: string)=>void): this {
            this.#provider.on(event, listener);
            return this;
        }

        once(event: 'user-deactivated', listener: (username: string)=>void): this {
            this.#provider.once(event, listener);
            return this;
        }

        static wrap(provider?: Contracts.UserProvider){
            return wrap(provider, UserProvider);
        }
    }

    export class AgentProvider implements Contracts.AgentProvider {
        readonly #agent: Contracts.AgentProvider;

        constructor(agent: Contracts.AgentProvider) {
            this.#agent = agent;
        }

        get uuid(): string{
            return this.#agent.uuid;
        }

        get client(): Contracts.ClientConnection{
            return ClientConnection.wrap(this.#agent.client);
        }

        get protocol(): Contracts.Protocol {
            return this.#agent.protocol;
        }

        get weight(): number {
            return this.#agent.weight;
        }

        get activeRequests(): number {
            return this.#agent.activeRequests;
        }

        get binding(): string {
            return this.#agent.binding;
        }

        get state(): 'active' | 'pausing' | 'shutting-down'{
            return this.#agent.state;
        }

        getAgent(sourceIp: string, sourcePort: number): Contracts.AsyncResult<Agent> {
            return this.#agent.getAgent(sourceIp, sourcePort);
        }

        static wrap(agent: Contracts.AgentProvider){
            return wrap(agent, AgentProvider);
        }
    }

    export class AgentPool implements Contracts.AgentPool {
        readonly #pool: Contracts.AgentPool;

        constructor(pool: Contracts.AgentPool) {
            this.#pool = pool;
        }

        attach(agent: Contracts.AgentProvider): Contracts.AsyncResult<void> {
            let pool = this.#pool;
            let p = AgentProvider.wrap(agent);
            return pool.attach(p);
        }

        detach(agent: Contracts.AgentProvider): Contracts.AsyncResult<void> {
            return this.#pool.detach(AgentProvider.wrap(agent));
        }

        detachAll(client: Contracts.ClientConnection): Contracts.AsyncResult<void> {
            return this.#pool.detachAll(ClientConnection.wrap(client));
        }

        select(domain: string): Contracts.AsyncResult<Contracts.AgentProvider | false> {
            return promise(this.#pool.select(domain))
                .then(a => a ? AgentProvider.wrap(a) : false);
        }

        isAvailable(domain: string): Contracts.AsyncResult<boolean> {
            return this.#pool.isAvailable(domain);
        }

        static wrap(pool: Contracts.AgentPool){
            return wrap(pool, AgentPool);
        }
    }

    export class ErrorResponseHandler implements Contracts.ErrorResponseHandler {
        readonly #handler: Contracts.ErrorResponseHandler;

        constructor(handler: Contracts.ErrorResponseHandler) {
            this.#handler = handler;
        }

        badGateway(request: Request, response: Response): Contracts.AsyncResult<void> {
            return this.#handler.badGateway(request, response);
        }

        serviceUnavailable(request: Request, response: Response): Contracts.AsyncResult<void> {
            return this.#handler.serviceUnavailable(request, response);
        }

        gatewayTimeout(request: Request, response: Response): Contracts.AsyncResult<void> {
            return this.#handler.gatewayTimeout(request, response);
        }

        static wrap(handler: Contracts.ErrorResponseHandler){
            return wrap(handler, ErrorResponseHandler);
        }
    }
}
