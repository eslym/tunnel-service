import {Contracts} from "./contracts";
import {randomUUID} from "crypto";
import {Connection} from "ssh2";
import {Console} from 'console';
import {Agent} from "http";
import {HttpAgent, HttpsAgent} from "./agents";
import Protocol = Contracts.Protocol;

interface PrivateProperties {
    uuid: string,
    bindings: Map<string, AgentProvider>,
    user?: Contracts.User,
    logging: boolean,
    mainIO?: Console,
    pendingLogs: string[],
    weight: number,
}

const privates = new WeakMap<Connection | TraitConnection, PrivateProperties>();

export type ClientConnection = Connection & TraitConnection;

class AgentProvider implements Contracts.AgentProvider {
    activeRequests: number;
    readonly binding: string;
    readonly client: ClientConnection;
    readonly protocol: Contracts.Protocol;
    readonly uuid: string;
    private _weight?: number;

    get weight(): number{
        if(this.hasOwnProperty('_weight')){
            return this._weight;
        }
        return this.client.weight;
    }

    set weight(weight: number){
        if(!Number.isNaN(weight) && Number.isFinite(weight) && weight > 0){
            this._weight = weight;
        } else {
            delete this._weight;
        }
    }

    get port(): number{
        return this.protocol === 'http' ? 80 : 443;
    }

    getAgent(sourceIp: string, sourcePort: number): Promise<Agent> {
        return new Promise<Agent>((res, rej)=>{
            this.client.forwardOut(this.binding, this.port, sourceIp, sourcePort, (err, ch)=>{
                if(err){
                    return rej(err);
                }
                let claz = this.protocol === 'http' ? HttpAgent : HttpsAgent;
                res(new claz(ch, this.client, this, {}));
            });
        });
    }
}

abstract class TraitConnection implements Contracts.ClientConnection {
    get uuid(): string{
        return privates.get(this).uuid;
    }

    get agents(): Contracts.AgentProvider[] {
        return Array.from(privates.get(this).bindings.values());
    }

    get user(): Contracts.User {
        return privates.get(this).user;
    }

    get bindings(): Map<string, AgentProvider> {
        return privates.get(this).bindings;
    }

    get console(): Console {
        return privates.get(this).mainIO;
    }

    set console(console: Console){
        let props = privates.get(this);
        props.mainIO = console;
        while (props.pendingLogs.length){
            console.log(props.pendingLogs.shift());
        }
    }

    get weight(){
        return privates.get(this).weight;
    }

    set weight(weight: number){
        privates.get(this).weight = weight;
    }

    async log(message: string, force?: boolean): Promise<void> {
        let props = privates.get(this);
        if(this.console){
            if(force || props.logging){
                this.console.log(message);
            }
        } else {
            if(force || props.logging){
                props.pendingLogs.push(message);
            }
        }
    }

    setLogging(enable: boolean){
        privates.get(this).logging = enable;
    }

    isBound(domain: string, protocol: Contracts.Protocol): boolean {
        return !this.bindings.hasOwnProperty(domain) ? false :
            this.bindings[domain].protocol === protocol;
    }

    setUser(user: Contracts.User): this{
        privates.get(this).user = user;
        return this;
    }

    createAgentProvider(binding: string, protocol: Protocol): AgentProvider{
        return Object.assign(Object.create(AgentProvider.prototype), {
            uuid: randomUUID(),
            client: this,
            binding, protocol,
            activeRequests: 0,
        });
    }
}

export function extendClient(client: Connection): ClientConnection {
    let proto = Object.create(Object.getPrototypeOf(client));
    privates.set(client, {
        uuid: randomUUID(),
        bindings: new Map<string, AgentProvider>(),
        logging: false,
        weight: 0,
        pendingLogs: [],
    });
    let descriptors = Object.getOwnPropertyDescriptors(TraitConnection.prototype);
    delete descriptors.constructor;
    Object.defineProperties(proto, descriptors);
    return Object.setPrototypeOf(client, proto);
}
