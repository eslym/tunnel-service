// noinspection JSUnusedGlobalSymbols

import {Agent, AgentOptions} from "http";
import {ServerChannel} from "ssh2";
import {ClientConnection} from "./extends";
import * as https from "https";
import * as tls from "tls";

function nothing(){}

interface BindingInfo {
    activeRequests: number;
}

// code from ssh2

export class HttpAgent extends Agent{
    readonly #channel: ServerChannel;
    readonly #client: ClientConnection;
    readonly #info: BindingInfo;
    constructor(channel: ServerChannel, client: ClientConnection, info: BindingInfo, options: AgentOptions) {
        super(options);
        this.#channel = channel;
        this.#client = client;
        this.#info = info;
    }

    public createConnection(options: AgentOptions, callback: (err, stream)=>void){
        this.#info.activeRequests ++;
        (this.#channel as any).setKeepAlive = nothing;
        (this.#channel as any).setNoDelay = nothing;
        (this.#channel as any).setTimeout = nothing;
        (this.#channel as any).ref = nothing;
        (this.#channel as any).unref = nothing;
        (this.#channel as any).destroySoon = this.#channel.destroy;
        this.#channel.on('close', ()=>this.#info.activeRequests--);
        callback(null, this.#channel);
    }
}

export class HttpsAgent extends https.Agent {
    readonly #channel: ServerChannel;
    readonly #client: ClientConnection;
    readonly #info: BindingInfo;
    constructor(channel: ServerChannel, client: ClientConnection, info: BindingInfo, options: AgentOptions) {
        super(options);
        this.#channel = channel;
        this.#client = client;
        this.#info = info;
    }

    public createConnection(options: AgentOptions, callback: (err, stream)=>void){
        (options as any).socket = this.#channel;
        let wrapped = tls.connect(options);
        const onClose = (() => {
            let called = false;
            return () => {
                if (called)
                    return;
                called = true;
                if (this.#channel.isPaused())
                    this.#channel.resume();
            };
        })();
        // 'end' listener is needed because 'close' is not emitted in some scenarios
        // in node v12.x for some unknown reason
        wrapped.on('end', onClose).on('close', onClose);
        callback(null, wrapped);
    }
}
