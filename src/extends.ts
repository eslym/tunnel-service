import {Contracts} from "./contracts";
import {randomUUID} from "crypto";
import {Connection, ServerChannel} from "ssh2";
import {Console} from 'console';
import {Agent} from "http";
import {HttpAgent, HttpsAgent} from "./agents";
import Protocol = Contracts.Protocol;
import {wait} from "./utils";
import {TimeoutError} from "./errors";

interface PrivateProperties {
    uuid: string,
    bindings: Map<string, AgentProvider>,
    user?: Contracts.User,
    logging: boolean,
    mainIO?: Console,
    pendingLogs: string[],
    weight: number,
    activeRequests: number,
    state: 'active' | 'pausing' | 'shutting-down'
}

const privates = new WeakMap<Connection | TraitConnection, PrivateProperties>();

export type ClientConnection = Connection & TraitConnection;

class AgentProvider implements Contracts.AgentProvider {
    readonly binding: string;
    readonly client: ClientConnection;
    readonly protocol: Contracts.Protocol;
    readonly uuid: string;
    private _weight?: number;
    readonly activeChannels: Set<ServerChannel>;
    readonly timeout: number;

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

    get activeRequests(): number {
        return this.client.activeRequests;
    }

    set activeRequests(requests) {
        this.client.activeRequests = requests;
    }

    get state(): 'active' | 'pausing' | 'shutting-down'{
        return this.client.state;
    }

    getAgent(sourceIp: string, sourcePort: number): Promise<Agent> {
        if(this.state !== 'active'){
            return new Promise<Agent>((res, rej)=>{
                rej(new Error('This provider is not active.'));
            });
        }
        return new Promise<Agent>((res, rej)=>{
            let before = new Date();
            let to = setTimeout(()=>{
                rej(new TimeoutError());
                to = undefined;
            }, this.timeout);
            this.client.forwardOut(this.binding, this.port, sourceIp, sourcePort, (err, ch)=>{
                if(!to) {
                    // If already timeout close the channel
                    if(!err) ch.close();
                    return;
                }
                clearTimeout(to);
                if(err){
                    return rej(err);
                }
                let diff = (new Date() as any) - (before as any);
                let timeout = ()=>{
                    ch.emit('error', new TimeoutError());
                    ch.close();
                };
                to = setTimeout(timeout, this.timeout - diff);
                this.activeChannels.add(ch);
                ch.once('close', ()=>{
                    this.activeChannels.delete(ch);
                    clearTimeout(to);
                });
                ch.on('data', ()=>{
                    clearTimeout(to);
                    to = setTimeout(timeout, this.timeout);
                });
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

    get activeRequests(){
        return privates.get(this).activeRequests;
    }

    set activeRequests(requests){
        privates.get(this).activeRequests = requests;
    }

    get state(){
        return privates.get(this).state;
    }

    async pause(){
        if(this.state !== 'active'){
            return;
        }
        privates.get(this).state = 'pausing';
        this.log('Pausing tunnel.', true).catch();
        let count = 0;
        while((this.state as string) === 'pausing'){
            if(this.activeRequests === 0 || count >= 100){
                break;
            }
            count++;
            await wait(50);
        }
        if((this.state as string) !== 'pausing'){
            return;
        }
        for(let agent of this.bindings.values()){
            for(let ch of agent.activeChannels){
                ch.close();
            }
        }
    }

    resume(){
        if(this.state !== 'pausing'){
            return;
        }
        privates.get(this).state = 'active';
        this.log('Tunnel resumed.', true).catch();
    }

    async shutdown(){
        if(this.state === 'shutting-down'){
            return;
        }
        privates.get(this).state = 'shutting-down';
        this.log('Shutting down tunnel.', true).catch();
        let count = 0;
        while (true){
            if(this.activeRequests === 0 || count >= 100){
                break;
            }
            await wait(50);
            count++;
        }
        (this as any as ClientConnection).end();
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

    createAgentProvider(binding: string, protocol: Protocol, timeout: number): AgentProvider{
        return Object.assign(Object.create(AgentProvider.prototype), {
            uuid: randomUUID(),
            client: this,
            binding, protocol,
            activeRequests: 0,
            activeChannels: new Set<ServerChannel>(),
            timeout: timeout ?? 30000
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
        activeRequests: 0,
        state: 'active',
    });
    let descriptors = Object.getOwnPropertyDescriptors(TraitConnection.prototype);
    delete descriptors.constructor;
    Object.defineProperties(proto, descriptors);
    return Object.setPrototypeOf(client, proto);
}
