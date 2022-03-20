/**
 * Server Commands
 */
import * as yargs from "yargs";
import { ClientConnection } from "./extends";
export interface ServerContext {
    client: ClientConnection;
    console: Console;
}
export interface SetWeightOptions {
    weight: number;
    domain: string[];
}
export declare const commands: yargs.Argv<ServerContext & SetWeightOptions>;
