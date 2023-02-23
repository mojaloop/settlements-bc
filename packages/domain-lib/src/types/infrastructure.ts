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
	ISettlementConfigDto,
	ISettlementBatchDto,
	ISettlementBatchAccountDto,
	ISettlementTransferDto,
	ISettlementMatrixRequestDto,
	ISettlementMatrixDto
} from "@mojaloop/settlements-bc-public-types-lib";

import {
	AccountsAndBalancesAccount, AccountsAndBalancesAccountType
} from "@mojaloop/accounts-and-balances-bc-public-types-lib";
import {AccountsAndBalancesJournalEntry} from "@mojaloop/accounts-and-balances-bc-public-types-lib/dist/types";


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
	getSettlementConfigByModel(model: string): Promise<ISettlementConfigDto | null>;
}

export interface ISettlementBatchRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	storeNewBatch(batch: ISettlementBatchDto): Promise<void>; // Throws if account.id is not unique.
	closeBatch(batch: ISettlementBatchDto): Promise<void>;

	batchExistsByBatchIdentifier(batchIdentifier: string): Promise<boolean>;
	getSettlementBatchById(id: string): Promise<ISettlementBatchDto | null>;
	getSettlementBatchByBatchIdentifier(batchIdentifier: string): Promise<ISettlementBatchDto | null>;
	getSettlementBatchesBy(fromDate: number, toDate: number, model?: string): Promise<ISettlementBatchDto[]>;
	getOpenSettlementBatch(fromDate: number, toDate: number, model: string, currency: string): Promise<ISettlementBatchDto | null>;
}

export interface ISettlementBatchAccountRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	storeNewSettlementBatchAccount(account: ISettlementBatchAccountDto, abAdapter: IAccountsBalancesAdapter): Promise<void>; // Throws if account.id is not unique.

	accountExistsById(accountId: string): Promise<boolean>;
	getAccountById(accountId: string, abAdapter?: IAccountsBalancesAdapter): Promise<ISettlementBatchAccountDto | null>;
	getAccountsByParticipantAccountId(partAccId: string, abAdapter?: IAccountsBalancesAdapter): Promise<ISettlementBatchAccountDto[]>;
	getAccountByParticipantAccountAndBatchId(
		partAccId: string,
		batchId: string,
		abAdapter?: IAccountsBalancesAdapter
	): Promise<ISettlementBatchAccountDto | null>;
	getAccountsByBatch(batch: ISettlementBatchDto, abAdapter?: IAccountsBalancesAdapter): Promise<ISettlementBatchAccountDto[]>;
}


export interface IParticipantAccountNotifier {
	init(): Promise<void>;
	destroy(): Promise<void>;
	publishSettlementMatrixExecuteEvent(matrix: ISettlementMatrixDto): Promise<void>;
}

// This is not needed, was the jouural entry
export interface ISettlementTransferRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	storeNewSettlementTransfer(transfer: ISettlementTransferDto, abAdapter: IAccountsBalancesAdapter): Promise<void>; // Throws if account.id is not unique.
	getSettlementTransfersByAccountId(accountId: string, abAdapter: IAccountsBalancesAdapter): Promise<ISettlementTransferDto[]>;
	getSettlementTransfersByAccountIds(accountId: string[], abAdapter: IAccountsBalancesAdapter): Promise<ISettlementTransferDto[]>;
}

export interface ISettlementMatrixRequestRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	storeNewSettlementMatrixRequest(req: ISettlementMatrixRequestDto): Promise<void>; // Throws if account.id is not unique.
	getSettlementMatrixById(settlementMatrixReqId: string): Promise<ISettlementMatrixRequestDto | null>;

	closeSettlementMatrixRequest(matrixReq: ISettlementMatrixRequestDto): Promise<void>;
}

