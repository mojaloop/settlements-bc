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
import {SettlementModel, SettlementBatchStatus, ISettlementBatchDto} from "@mojaloop/settlements-bc-public-types-lib";
import * as console from "console";

export class SettlementBatchRepoMock implements ISettlementBatchRepo {
	batches: Array<ISettlementBatchDto> = [];

	async init(): Promise<void> {
		return Promise.resolve();
	}
	async destroy(): Promise<void>{
		return Promise.resolve();
	}

	async storeNewBatch(batch: ISettlementBatchDto): Promise<void> {
		if (batch === undefined) return Promise.resolve();
		this.batches.push(batch);
		return Promise.resolve();
	}

	async closeBatch(batch: ISettlementBatchDto): Promise<void> {
		if (batch === undefined) return Promise.resolve();

		this.batches.forEach(batchIter => {
			if (batch.id === batchIter.id) {
				batchIter.batchStatus = SettlementBatchStatus.CLOSED;
				batchIter.timestamp = Date.now();
			}
		});
		return Promise.resolve();
	}

	async getSettlementBatchById(batchIdentifier: string): Promise<ISettlementBatchDto | null> {
		if (batchIdentifier === undefined || batchIdentifier.trim() === '') return Promise.resolve(null);

		for (const batchIter of this.batches) {
			if (batchIter.id === batchIdentifier) return Promise.resolve(batchIter);
			else if (batchIter.batchIdentifier === batchIdentifier) return Promise.resolve(batchIter);
		}

		return Promise.resolve(null);
	}

	async batchExistsByBatchIdentifier(batchIdentifier: string): Promise<boolean> {
		const batchById = await this.getSettlementBatchById(batchIdentifier);
		return Promise.resolve(batchById !== null);
	}

	async getSettlementBatchesBy(fromDate: number, toDate: number, model?: SettlementModel): Promise<ISettlementBatchDto[]> {
		let returnVal : Array<ISettlementBatchDto> = [];

		this.batches.forEach(batchIter => {
			if (batchIter.timestamp >= fromDate && batchIter.timestamp <= toDate) {
				if (model === undefined) returnVal.push(batchIter);
				else if (batchIter.settlementModel === model) returnVal.push(batchIter);
			}
		});

		return Promise.resolve(returnVal);
	}

	async getOpenSettlementBatch(fromData: number, toDate: number, model: SettlementModel): Promise<ISettlementBatchDto | null> {
		for (const batchIter of this.batches) {
			if ((batchIter.timestamp >= fromData && batchIter.timestamp <= toDate) &&
				(batchIter.settlementModel === model) && batchIter.batchStatus === SettlementBatchStatus.OPEN) {
				return Promise.resolve(batchIter);
			}
		}
		return Promise.resolve(null);
	}
}
