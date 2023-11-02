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
 *  - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

import {
	ISettlementConfig,
	ISettlementBatch,
	ISettlementBatchTransfer,
	ISettlementMatrix,
	BatchSearchResults,
	MatrixSearchResults,
	BatchTransferSearchResults,
} from "@mojaloop/settlements-bc-public-types-lib";

import {
	AccountsAndBalancesAccount, AccountsAndBalancesAccountType,AccountsAndBalancesJournalEntry
} from "@mojaloop/accounts-and-balances-bc-public-types-lib";


export interface IAccountsBalancesAdapter {
	init(): Promise<void>;
	destroy(): Promise<void>;

	setToken(accessToken: string): void;
	setUserCredentials(client_id: string, username: string, password: string): void;
	setAppCredentials(client_id: string, client_secret: string): void;

	createAccount(requestedId: string, ownerId: string, type: AccountsAndBalancesAccountType, currencyCode: string): Promise<string>;
	getAccount(accountId: string): Promise<AccountsAndBalancesAccount | null>;
	getAccounts(accountIds: string[]): Promise<AccountsAndBalancesAccount[]>;
	getParticipantAccounts(participantId: string): Promise<AccountsAndBalancesAccount[]>;

	createJournalEntry(
		requestedId: string,
		ownerId: string,
		currencyCode: string,
		amount: string,
		pending: boolean,
		debitedAccountId: string,
		creditedAccountId: string
	): Promise<string>;

	getJournalEntriesByAccountId(accountId: string): Promise<AccountsAndBalancesJournalEntry[]>;
}

export interface ISettlementConfigRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	storeConfig(config: ISettlementConfig):Promise<void>;

	getAllSettlementConfigs(): Promise<ISettlementConfig[]>;
	/**
	 * @todo rename to getSettlementConfigByModelName
	 * @param model Model name
	 */
	getSettlementConfig(id: string): Promise<ISettlementConfig | null>;
	getSettlementConfigByModelName(modelName: string): Promise<ISettlementConfig | null>;
}

export interface ISettlementBatchRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;

	storeNewBatch(batch: ISettlementBatch): Promise<void>;
	updateBatch(batch: ISettlementBatch): Promise<void>;

	//get by full identifier = batch name + batch sequence number
	getBatch(id: string): Promise<ISettlementBatch | null>;

	// there can be only one open with the same name (excludes sequence number)
	getOpenBatchByName(batchName: string): Promise<ISettlementBatch | null>;

	// there can be multiple batches with the same name (excludes sequence number)
	getBatchesByName(batchName: string): Promise<ISettlementBatch[]>;

	getBatchesByNameWithPagi(batchName: string, pageIndex?: number, pageSize?: number,): Promise<BatchSearchResults>;

	// there can be multiple batches with the same name (excludes sequence number)
	getBatchesByIds(batchIds: string[]): Promise<ISettlementBatch[]>;

	getBatchesByCriteria(
		fromDate: number,
		toDate: number,
		model: string,
		currencyCodes: string[],
		batchStatuses: string[],
	): Promise<ISettlementBatch[]>;

	getBatchesByCriteriaWithPagi(
		fromDate: number,
		toDate: number,
		model: string,
		currencyCodes: string[],
		batchStatuses: string[],
		pageIndex?: number,
		pageSize?: number,
	): Promise<BatchSearchResults>;
}

export interface ISettlementBatchTransferRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	storeBatchTransfer(batchTransfer: ISettlementBatchTransfer): Promise<void>;
	getBatchTransfersByBatchIds(batchIds: string[]): Promise<ISettlementBatchTransfer[]>;
	getBatchTransfersByBatchIdsWithPagi(
		batchIds: string[], 
		pageIndex?: number, 
		pageSize?: number,
	): Promise<BatchTransferSearchResults>;
	getBatchTransfersByBatchNames(batchNames: string[]): Promise<ISettlementBatchTransfer[]>;
	getBatchTransfersByTransferId(transferId: string): Promise<ISettlementBatchTransfer[]>;
	getBatchTransfers(): Promise<ISettlementBatchTransfer[]>;
}

export interface IParticipantAccountNotifier {
	init(): Promise<void>;
	destroy(): Promise<void>;
	publishSettlementMatrixExecuteEvent(matrix: ISettlementMatrix): Promise<void>;
}

export interface ISettlementMatrixRequestRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	storeMatrix(matrix: ISettlementMatrix): Promise<void>; // Throws if account.id is not unique.
	getMatrixById(id: string): Promise<ISettlementMatrix | null>;
	getMatrices(
		matrixId?: string,
		type?: string,
		state?: string,
		model?: string,
		currencyCodes?: string[],
		createdAt?: string,
		pageIndex?: number,
		pageSize?: number,
	): Promise<MatrixSearchResults>;

	getIdleMatricesWithBatchId(batchId: string): Promise<ISettlementMatrix[]>;
}
