import { Contracts } from "./contracts";
import AsyncResult = Contracts.AsyncResult;
import AgentProvider = Contracts.AgentProvider;
export declare function promise<T>(value: AsyncResult<T>): Promise<T>;
export declare function selectRandomly(agents: AgentProvider[]): AgentProvider;
export declare function selectLessRequest(agents: AgentProvider[]): AgentProvider;
interface MatchingResult<T> {
    value?: T;
    found: boolean;
}
export declare class DomainMapping<T> {
    #private;
    resolve(domain: string): MatchingResult<T>;
    getByPattern(pattern: string): T;
    hasPattern(pattern: string): boolean;
    addByPattern(pattern: string, value: T): this;
    removePattern(pattern: string): this;
}
export declare function wait(milliseconds: number): Promise<unknown>;
export {};
