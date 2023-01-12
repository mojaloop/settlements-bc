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
	SettlementModel,
	ISettlementBatchAccountDto,
	IParticipantAccountDto,
	ISettlementTransferDto
} from "@mojaloop/settlements-bc-public-types-lib";

export interface ISettlementConfigRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	getSettlementConfigByModel(model: SettlementModel): Promise<ISettlementConfigDto | null>;
}

export interface ISettlementBatchRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	storeNewBatch(batch: ISettlementBatchDto): Promise<void>; // Throws if account.id is not unique.
	closeBatch(batch: ISettlementBatchDto): Promise<void>;

	batchExistsByBatchIdentifier(batchIdentifier: string): Promise<boolean>;
	getSettlementBatchesBy(fromData: number, toDate: number, model?: SettlementModel): Promise<ISettlementBatchDto[]>;
	getOpenSettlementBatch(fromData: number, toDate: number, model?: SettlementModel): Promise<ISettlementBatchDto | null>;
}

export interface ISettlementBatchAccountRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	accountExistsById(accountId: string): Promise<boolean>;
	storeNewSettlementBatchAccount(account: ISettlementBatchAccountDto): Promise<void>; // Throws if account.id is not unique.
	getAccountById(accountId: string): Promise<ISettlementBatchAccountDto | null>;
	getAccountsByExternalId(externalId: string): Promise<ISettlementBatchAccountDto[]>;
	getAccountsByBatch(batch: ISettlementBatchDto): Promise<ISettlementBatchAccountDto[]>;
	updateAccountCreditBalanceAndTimestampById(
		accountId: string,
		creditBalance: string,
		timeStampLastJournalEntry: number): Promise<void>;
	updateAccountDebitBalanceAndTimestampById(
		accountId: string,
		debitBalance: string,
		timeStampLastJournalEntry: number): Promise<void>;
}

export interface IParticipantAccountRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	getAccountById(accountId: string): Promise<IParticipantAccountDto | null>;
}


export interface ISettlementTransferRepo {
	init(): Promise<void>;
	destroy(): Promise<void>;
	transferExistsById(id: string): Promise<boolean>;
	storeNewSettlementTransfer(transfer: ISettlementTransferDto): Promise<void>; // Throws if account.id is not unique.
	getSettlementTransfersByAccountId(accountId: string): Promise<ISettlementTransferDto[]>;
}
