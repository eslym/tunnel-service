/**
 * Server Commands
 */

import * as yargs from "yargs";
import {ArgumentsCamelCase, argv, Argv} from "yargs";
import {Console} from "console";
import {ClientConnection} from "./extends";

export interface ServerContext {
    client: ClientConnection
    console: Console;
}

export interface SetWeightOptions {
    weight: number;
    domain: string[];
}

// This is the only way to keep multiple instance of yargs for different purpose
export const commands = (new (yargs as any)() as Argv).scriptName("")
    .command('nolog', 'Turn off log for the client', {}, (argv: ArgumentsCamelCase<ServerContext>) => {
        argv.client.setLogging(false);
        argv.console.log(`Client logging disabled.`);
    })
    .command('log', 'Turn on log for the client', {}, (argv: ArgumentsCamelCase<ServerContext>) => {
        argv.client.setLogging(true);
        argv.console.log(`Client logging enabled.`);
    })
    .command('ls', 'List the bindings', {}, (argv: ArgumentsCamelCase<ServerContext>) => {
        for(let pair of argv.client.bindings.entries()){
            argv.console.log(`${pair[0]}: ${pair[1].uuid}`);
        }
    })
    .command('pause', 'Pause the current tunnel and stop receiving requests', {}, (argv: ArgumentsCamelCase<ServerContext>)=>{
        if(argv.client.state !== 'active'){
            argv.console.log('The current connection is not in active state.');
            return;
        }
        return argv.client.pause();
    })
    .command('resume', 'Resume the current tunnel and continue receiving requests', {}, (argv: ArgumentsCamelCase<ServerContext>)=>{
        if(argv.client.state !== 'pausing'){
            argv.console.log('The current connection is not pausing.');
            return;
        }
        return argv.client.resume();
    })
    .command('exit', 'Shutdown all tunnels and exit.', {}, (argv: ArgumentsCamelCase<ServerContext>)=>{
        if(argv.client.state === "shutting-down"){
            argv.console.log('This connection is already shutting down.');
            return;
        }
        return argv.client.shutdown();
    })
    .command('requests', 'Get the number of active requests.', {}, (argv: ArgumentsCamelCase<ServerContext>)=>{
        argv.console.log(argv.client.activeRequests);
    })
    .command('set-weight <weight>', 'Set the weight for load balancing', (cmd) => {
        cmd.positional('weight', {
            describe: 'The weight for the connected client',
            type: "number",
        }).option('domain', {
            describe: 'The set the weight for specific binding, set the global weight if no specify any',
            alias: ['d'],
            array: true,
            type: 'string',
        });
    }, ((argv: ArgumentsCamelCase<ServerContext & SetWeightOptions>)=>{
        if(Array.isArray(argv.domain) && argv.domain.length > 0){
            for (let domain of argv.domain){
                if(argv.client.bindings.has(domain)){
                    let provider = argv.client.bindings.get(domain);
                    provider.weight = argv.weight;
                    argv.console.log(`The weight for binding "${domain}" set to ${provider.weight}`);
                } else {
                    argv.console.warn(`This client is not bounded to ${domain}`);
                }
            }
        } else {
            if(!Number.isNaN(argv.weight) && Number.isFinite(argv.weight) && argv.weight > 0){
                argv.client.weight = argv.weight;
                argv.console.log(`Client weight set to ${argv.weight}`);
            } else {
                argv.console.error(`Invalid weight`);
            }
        }
    }))
    .demandCommand()
    .strict()
    .strictCommands()
    .help();