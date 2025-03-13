/*****
License
--------------
Copyright © 2020-2025 Mojaloop Foundation
The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

Contributors
--------------
This is the official list of the Mojaloop project contributors for this file.
Names of the original copyright holders (individuals or organizations)
should be listed with a '*' in the first column. People who have
contributed from an organization can be listed under the organization
that actually holds the copyright for their contributions (see the
Mojaloop Foundation for an example). Those individuals should have
their names indented and be marked with a '-'. Email address can be added
optionally within square brackets <email>.

* Mojaloop Foundation
- Name Surname <name.surname@mojaloop.io>

* ILF
- Jason Bruwer jason@interledger.org
*****/

"use struct";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {Redis} from "ioredis";
import { ISettlementBatchCacheRepo } from "@mojaloop/settlements-bc-domain-lib";
import {BatchSearchResults} from "@mojaloop/settlements-bc-public-types-lib";

export class SettlementBatchCacheRepoRedis implements ISettlementBatchCacheRepo {
    private readonly _logger: ILogger;
    private readonly _keyPrefix= "settlementBatch_";
    private _redisClient: Redis;

    constructor(logger: ILogger, redisHost: string, redisPort: number) {
        this._logger = logger.createChild(this.constructor.name);
        this._redisClient = new Redis({
            port: redisPort,
            host: redisHost,
            lazyConnect: true
        });
    }

    async init(): Promise<void> {
        try{
            await this._redisClient.connect();
            this._logger.debug("Connected to Redis successfully");
        } catch(error: unknown) {
            this._logger.error(`Unable to connect to redis cache: ${(error as Error).message}`);
            throw error;
        }
    }

    async destroy(): Promise<void> {
        if (this._redisClient) await this._redisClient.disconnect();
        return Promise.resolve();
    }

    private _getKeyWithPrefix(key: string): string {
        return this._keyPrefix + key;
    }

    async invalidate(batchName: string): Promise<void> {
        await this._redisClient.del(this._getKeyWithPrefix(batchName));
        return Promise.resolve();
    }

    async set(batchName: string, batchResult: BatchSearchResults): Promise<void> {
        if (batchName === undefined || batchResult == undefined) return Promise.resolve();

        const parsed: any = {...batchResult};
        await this._redisClient.set(this._getKeyWithPrefix(batchName), JSON.stringify(parsed));
    }

    async get(batchName: string): Promise<BatchSearchResults | null | undefined> {
        const objStr = await this._redisClient.get(this._getKeyWithPrefix(batchName));
        if (!objStr) return null;
        try {
            return JSON.parse(objStr);
        } catch (e) {
            this._logger.error(e);
            return null;
        }
    }
}
