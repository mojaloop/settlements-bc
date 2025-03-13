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

Contributors
--------------
This is the official list (alphabetical ordering) of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Coil
 * - Jason Bruwer <jason.bruwer@coil.com>
*****/

"use strict";

import {ISettlementBatchCacheRepo} from "@mojaloop/settlements-bc-domain-lib";
import {BatchSearchResults} from "@mojaloop/settlements-bc-public-types-lib";

export class SettlementBatchCacheRepoMock implements ISettlementBatchCacheRepo {
	private _batchesCache: Map<string, BatchSearchResults> = new Map<string, BatchSearchResults>();

	async init(): Promise<void> {
		return Promise.resolve();
	}

	async destroy(): Promise<void>{
		return Promise.resolve();
	}

	async invalidate(batchName: string): Promise<void> {
		this._batchesCache.delete(batchName);
		return Promise.resolve();
	}

	async set(batchName: string, batchResult: BatchSearchResults): Promise<void> {
		if (batchName === undefined || batchResult == undefined) return Promise.resolve();

		this._batchesCache.set(batchName, batchResult);
		return Promise.resolve();
	}

	async get(batchName: string): Promise<BatchSearchResults | null | undefined> {
		return Promise.resolve(this._batchesCache.get(batchName));
	}
}
