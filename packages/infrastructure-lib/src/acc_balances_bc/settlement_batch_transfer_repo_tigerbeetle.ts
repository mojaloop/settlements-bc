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

import {
	IAccountsBalancesAdapter,
	ISettlementBatchRepo,
	ISettlementBatchTransferRepo
} from "@mojaloop/settlements-bc-domain-lib";
import {
	BatchTransferSearchResults,
	ISettlementBatchAccount,
	ISettlementBatchTransfer
} from "@mojaloop/settlements-bc-public-types-lib";
import {AccountsAndBalancesJournalEntry} from "@mojaloop/accounts-and-balances-bc-public-types-lib";

export class SettlementBatchTransferRepoTigerBeetle implements ISettlementBatchTransferRepo {
	private readonly _batchRepo: ISettlementBatchRepo;
	private readonly _accBalAdapter: IAccountsBalancesAdapter;

	constructor(
		batchRepo: ISettlementBatchRepo,
		accBalAdapter: IAccountsBalancesAdapter
	) {
		this._batchRepo = batchRepo;
		this._accBalAdapter = accBalAdapter;
	}

	async init(): Promise<void> {
		return Promise.resolve();
	}

	async destroy(): Promise<void>{
		return Promise.resolve();
	}

	async storeBatchTransfer(...batchTransfer: ISettlementBatchTransfer[]): Promise<void> {
		// Already stored via the adapter.
		return Promise.resolve();
	}

	async getBatchTransfersByBatchIds(
		batchIds: string[],
		pageIndex: number = 0,
        pageSize: number = 100,
	): Promise<BatchTransferSearchResults>{
		const accountsForTxnLookup : ISettlementBatchAccount[] = [];
		// TODO should use ISettlementBatchRepo.getBatchesByIds() instead of the getBatch inside a for loop
		for (const id of batchIds) {
			const batch = await this._batchRepo.getBatch(id);
			if (!batch || !batch.accounts) continue;

			const accounts: ISettlementBatchAccount[] = batch.accounts;
			for (const account of accounts) {
				const accWithIdExisting = accountsForTxnLookup.filter(
					itm => account.participantId === itm.participantId);
				if (!accWithIdExisting.length) accountsForTxnLookup.push(account);
			}
		}
		const searchResultsEmpty: BatchTransferSearchResults = {
			pageIndex: pageIndex,
			pageSize: pageSize,
			totalPages: 0,
			items: []
		};

		if (accountsForTxnLookup.length === 0) return Promise.resolve(searchResultsEmpty);

		for (const accForLookup of accountsForTxnLookup) {
			const abTxns: AccountsAndBalancesJournalEntry[] = await this._accBalAdapter.getJournalEntriesByAccountId(accForLookup.accountExtId);
			const returnItems: ISettlementBatchTransfer[] = [];
			if (abTxns.length) {
				for (const abTxn of abTxns) {
					returnItems.push({
						amount: abTxn.amount,
						batchId: "",// TODO do later.
						batchName: "",// TODO do later.
						currencyCode: abTxn.currencyCode,
						journalEntryId: abTxn.id!,
						matrixId: "",//TODO do later.
						payeeFspId: abTxn.creditedAccountId,
						payerFspId: abTxn.debitedAccountId,
						transferId: abTxn.ownerId!,
						transferTimestamp: abTxn.timestamp!
					});
				}
			}

			const searchResults: BatchTransferSearchResults = {
				pageIndex: pageIndex,
				pageSize: pageSize,
				totalPages: 0,
				items: returnItems
			};
			return Promise.resolve(searchResults);
		}

		return Promise.resolve(searchResultsEmpty);
	}

	async getBatchTransfersByBatchNames(batchNames: string[]): Promise<ISettlementBatchTransfer[]> {
		return Promise.resolve([]);
	}

	async getBatchTransfersByTransferId(transferId: string): Promise<ISettlementBatchTransfer[]> {
		return Promise.resolve([]);
	}

	async getBatchTransfers(pageIndex?: number, pageSize?: number): Promise<BatchTransferSearchResults>{
		const searchResults: BatchTransferSearchResults = {
			pageIndex: pageIndex ? pageIndex : 0,
			pageSize: pageSize ? pageSize : 15,
			totalPages: 0,
			items: []
		};
		return Promise.resolve(searchResults);
	}
}
