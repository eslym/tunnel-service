#!/usr/bin/node

import * as yargs from "yargs";
import {ArgumentsCamelCase, Argv} from "yargs";
import * as fs from "fs";
import * as path from "path";
import {LaunchOption, TunnelService} from "./service";
import {DefaultAgentPool, FileUserProvider, TextPlainErrorResponseHandler} from "./builtins";
import {selectLessRequest, selectRandomly} from "./utils";

interface CliOptions {
    http: number,
    ssh: number,
    key: string,
    auth: string,
    proxy: string,
    timeout: number,
    balancing: string,
}

// This is the only way to keep multiple instance of yargs for different purpose
(new (yargs as any)() as Argv).command('$0', 'Start a tunnel server', (cmd)=>{
    cmd.option('httpPort', {
        describe: 'The port of the HTTP reverse proxy listening',
        alias: ['H', 'http'],
        type: 'number',
    }).option('sshPort', {
        describe: 'The port of the SSH service listening',
        alias: ['s', 'ssh'],
        type: 'number',
    }).option('key', {
        describe: 'Path to the ssh server key',
        alias: ['k'],
        type: 'string',
    }).option('auth', {
        describe: 'Path to the user configuration folder',
        alias: ['a'],
        type: 'string',
    }).option('trustedProxy', {
        describe: 'The reverse proxy in-front of this proxy',
        alias: ['p', 'proxy'],
        type: 'string',
        default: '127.0.0.1/8',
    }).option('proxyTimeout', {
        describe: 'The timeout of proxy request, in milliseconds',
        alias: ['t', 'timeout'],
        type: 'number',
        default: 30000,
    }).option('balancing', {
        describe: 'The load-balancing method, "requests" for request count, "random" for random.',
        alias: ['b', 'balance', 'lb', 'loadBalancing'],
        type: "string",
        default: 'requests',
    })
        .demandOption(['key', 'auth'])
        .default('httpPort', 0)
        .default('sshPort', 0);
}, (args: ArgumentsCamelCase<CliOptions>)=>{
    if(!fs.existsSync(args.key)){
        console.error(`SSH Server key not exists: ${args.key}`);
        return;
    }
    if(!fs.existsSync(args.auth)){
        console.error(`User configuration folder not exists: ${args.key}`);
        return;
    }
    let options: LaunchOption = {
        sshPort: args.ssh,
        httpPort: args.http,
        serverKey: fs.readFileSync(args.key),
        agentPool: new DefaultAgentPool(args.balancing === 'requests' ? selectLessRequest : selectRandomly),
        userProvider: new FileUserProvider(args.auth),
        errorResHandler: new TextPlainErrorResponseHandler(),
        proxyTimeout: args.timeout,
        trustedProxy: args.proxy,
    };
    let service = new TunnelService(options);
    service.start();
}, [(argv: ArgumentsCamelCase<CliOptions>)=>{
    argv.key = path.resolve(argv.key);
    argv.auth = path.resolve(argv.auth);
}]).parse(process.argv);
