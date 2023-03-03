/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

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

 --------------
 ******/

"use strict";

import {ISettlementBatchRepo} from "@mojaloop/settlements-bc-domain-lib";
import {ISettlementBatch} from "@mojaloop/settlements-bc-public-types-lib";

export class SettlementBatchRepoMock implements ISettlementBatchRepo {

	batches: Array<ISettlementBatch> = [];

	async init(): Promise<void> {
		return Promise.resolve();
	}
	async destroy(): Promise<void>{
		return Promise.resolve();
	}

	async storeNewBatch(batch: ISettlementBatch): Promise<void> {
		return this.updateBatch(batch);
	}

	async updateBatch(batch: ISettlementBatch): Promise<void> {
		if (batch === undefined) return Promise.resolve();
		this.batches.push(batch);
		return Promise.resolve();
	}

	async getBatch(batchIdentifier: string): Promise<ISettlementBatch | null> {
		const returnVal = this.batches.find(value => value.id === batchIdentifier);
		return Promise.resolve(returnVal || null);
	}

	async getOpenBatchByName(batchName: string): Promise<ISettlementBatch | null> {
		const returnVal = this.batches.find(value => value.id===batchName || !value.isClosed);
		return Promise.resolve(returnVal || null);
	}

	async getBatchesByName(batchName: string): Promise<ISettlementBatch[]> {
		const returnVal: Array<ISettlementBatch> = this.batches.filter(value => batchName == value.batchName);

		return Promise.resolve(returnVal);
	}

	async getBatchesByIds(ids: string[]): Promise<ISettlementBatch[]> {
		const returnVal: Array<ISettlementBatch> = this.batches.filter(value => ids.includes(value.id) );

		return Promise.resolve(returnVal);
	}


	async getBatchesByCriteria(fromDate: number, toDate: number, model?: string): Promise<ISettlementBatch[]> {
		const returnVal: Array<ISettlementBatch> = this.batches.filter(value => {
			return (value.timestamp>=fromDate && value.timestamp <= toDate) && (!model || value.settlementModel === model);
		});

		return Promise.resolve(returnVal);
	}

}
