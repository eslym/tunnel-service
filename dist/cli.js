#!/usr/bin/node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const yargs = require("yargs");
const fs = require("fs");
const path = require("path");
const service_1 = require("./service");
const builtins_1 = require("./builtins");
const utils_1 = require("./utils");
// This is the only way to keep multiple instance of yargs for different purpose
new yargs().command('$0', 'Start a tunnel server', (cmd) => {
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
}, (args) => {
    if (!fs.existsSync(args.key)) {
        console.error(`SSH Server key not exists: ${args.key}`);
        return;
    }
    if (!fs.existsSync(args.auth)) {
        console.error(`User configuration folder not exists: ${args.key}`);
        return;
    }
    let options = {
        sshPort: args.ssh,
        httpPort: args.http,
        serverKey: fs.readFileSync(args.key),
        agentPool: new builtins_1.DefaultAgentPool(args.balancing === 'requests' ? utils_1.selectLessRequest : utils_1.selectRandomly),
        userProvider: new builtins_1.FileUserProvider(args.auth),
        errorResHandler: new builtins_1.TextPlainErrorResponseHandler(),
        proxyTimeout: args.timeout,
        trustedProxy: args.proxy,
    };
    let service = new service_1.TunnelService(options);
    service.start();
}, [(argv) => {
        argv.key = path.resolve(argv.key);
        argv.auth = path.resolve(argv.auth);
    }]).parse(process.argv);

//# sourceMappingURL=cli.js.map
