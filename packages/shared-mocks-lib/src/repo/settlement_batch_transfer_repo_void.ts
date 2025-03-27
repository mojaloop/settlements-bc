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

* Coil

* - Jason Bruwer <jason.bruwer@coil.com>
*****/

"use strict";

/* eslint-disable @typescript-eslint/no-unused-vars */

import {ISettlementBatchTransferRepo} from "@mojaloop/settlements-bc-domain-lib";
import { BatchTransferSearchResults, ISettlementBatchTransfer } from "@mojaloop/settlements-bc-public-types-lib";

const MAX_ENTRIES_PER_PAGE = 100;

export class SettlementBatchTransferRepoVoid implements ISettlementBatchTransferRepo {

	async init(): Promise<void> {
		return Promise.resolve();
	}
	async destroy(): Promise<void>{
		return Promise.resolve();
	}

	async storeBatchTransfer(...batchTransfer: ISettlementBatchTransfer[]): Promise<void> {
		return Promise.resolve();
	}

	async getBatchTransfersByBatchIds(
		batchIds: string[],
		pageIndex: number = 0,
        pageSize: number = MAX_ENTRIES_PER_PAGE,
	): Promise<BatchTransferSearchResults>{
		const searchResults: BatchTransferSearchResults = {
			pageIndex: pageIndex,
			pageSize: pageSize,
			totalPages: 0,
			items: []
		};
		return Promise.resolve(searchResults);
	}

	async getBatchTransfersByBatchNames(batchNames: string[]): Promise<ISettlementBatchTransfer[]> {
		return [];
	}

	async getBatchTransfersByTransferId(transferId: string): Promise<ISettlementBatchTransfer[]> {
		return [];
	}

	async getBatchTransfers(
		pageIndex: number = 0,
		pageSize: number = MAX_ENTRIES_PER_PAGE
	): Promise<BatchTransferSearchResults> {
		const searchResults: BatchTransferSearchResults = {
			pageIndex: pageIndex,
			pageSize: pageSize,
			totalPages: 0,
			items: []
		};
		return Promise.resolve(searchResults);
	}

	async getAllTransfersByBatchId(batchId: string): Promise<ISettlementBatchTransfer[]> {
		return [];
	}
}
