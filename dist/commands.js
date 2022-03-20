"use strict";
/**
 * Server Commands
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.commands = void 0;
const yargs = require("yargs");
// This is the only way to keep multiple instance of yargs for different purpose
exports.commands = new yargs().scriptName("")
    .command('nolog', 'Turn off log for the client', {}, (argv) => {
    argv.client.setLogging(false);
    argv.console.log(`Client logging disabled.`);
})
    .command('log', 'Turn on log for the client', {}, (argv) => {
    argv.client.setLogging(true);
    argv.console.log(`Client logging enabled.`);
})
    .command('ls', 'List the bindings', {}, (argv) => {
    for (let pair of argv.client.bindings.entries()) {
        argv.console.log(`${pair[0]}: ${pair[1].uuid}`);
    }
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
}, ((argv) => {
    if (Array.isArray(argv.domain) && argv.domain.length > 0) {
        for (let domain of argv.domain) {
            if (argv.client.bindings.has(domain)) {
                let provider = argv.client.bindings.get(domain);
                provider.weight = argv.weight;
                argv.console.log(`The weight for binding "${domain}" set to ${provider.weight}`);
            }
            else {
                argv.console.warn(`This client is not bounded to ${domain}`);
            }
        }
    }
    else {
        if (!Number.isNaN(argv.weight) && Number.isFinite(argv.weight) && argv.weight > 0) {
            argv.client.weight = argv.weight;
            argv.console.log(`Client weight set to ${argv.weight}`);
        }
        else {
            argv.console.error(`Invalid weight`);
        }
    }
}))
    .demandCommand()
    .strict()
    .strictCommands()
    .help();

//# sourceMappingURL=commands.js.map