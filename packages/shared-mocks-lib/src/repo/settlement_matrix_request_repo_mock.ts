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

import {ISettlementMatrixRequestRepo} from "@mojaloop/settlements-bc-domain-lib";
import {ISettlementMatrix, MatrixSearchResults} from "@mojaloop/settlements-bc-public-types-lib";

const MAX_ENTRIES_PER_PAGE = 100;

export class SettlementMatrixRequestRepoMock implements ISettlementMatrixRequestRepo {
	matrixRequests: Array<ISettlementMatrix> = [];

	async init(): Promise<void> {
		return Promise.resolve();
	}
	async destroy(): Promise<void>{
		return Promise.resolve();
	}

	async storeMatrix(matrixReq: ISettlementMatrix): Promise<void> {
		if (matrixReq === undefined) return Promise.resolve();

		const newArray: Array<ISettlementMatrix> = this.matrixRequests.filter(value => value.id !== matrixReq.id);
		newArray.push(matrixReq);
		this.matrixRequests = newArray;
		return Promise.resolve();
	}

	async getMatrixById(settlementMatrixReqId: string): Promise<ISettlementMatrix | null> {
		if (settlementMatrixReqId === undefined) return Promise.resolve(null);

		for (const matrixReqIter of this.matrixRequests) {
			if (matrixReqIter.id === settlementMatrixReqId) {
				return Promise.resolve(matrixReqIter);
			}
		}
		return Promise.resolve(null);
	}

	async getMatrices(
		matrixId?: string,
		type?: string,
		state?: string,
		model?: string,
		currencyCodes?: string[],
		startDate?: number,
        endDate?: number,
		pageIndex: number = 0,
        pageSize: number = MAX_ENTRIES_PER_PAGE,
	): Promise<MatrixSearchResults>{
		pageIndex = Math.max(pageIndex, 0);
		pageSize = Math.min(pageSize, MAX_ENTRIES_PER_PAGE);
		const index = pageIndex * pageSize;
		const total = index + pageSize;

		const returnVal: ISettlementMatrix[] = [];

		for (const matrixReqIter of this.matrixRequests) {
			if (!state || matrixReqIter.state.toUpperCase() !== state.toUpperCase()) {
				returnVal.push(matrixReqIter);
			}
		}

		const searchResults: MatrixSearchResults = {
			pageIndex: pageIndex,
			pageSize: pageSize,
			totalPages: 0,
			items: []
		};

		if (returnVal.length > 0) {
			const paginatedVal = returnVal.slice(index, total);
			searchResults.items = paginatedVal;
			searchResults.totalPages = Math.ceil(returnVal.length / pageSize);
		}

		return Promise.resolve(searchResults);
	}

	async getIdleMatricesWithBatchId(batchId: string): Promise<ISettlementMatrix[]>{
		const ret: ISettlementMatrix[] = [];
		for (const matrixReqIter of this.matrixRequests) {
			if (matrixReqIter.state === "IDLE") {
				for (const batchIter of matrixReqIter.batches) {
					if (batchIter.id === batchId) {
						ret.push(matrixReqIter);
						break;
					}
				}
			}
		}
		return Promise.resolve(ret);
	}
}
