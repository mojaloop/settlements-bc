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

import {ISettlementBatchAccountRepo} from "@mojaloop/settlements-bc-domain-lib";
import {ISettlementBatchAccountDto, ISettlementBatchDto} from "@mojaloop/settlements-bc-public-types-lib";
import console from "console";
export class SettlementBatchAccountRepoMock implements ISettlementBatchAccountRepo {
	batchAccounts: Array<ISettlementBatchAccountDto> = [];

	async init(): Promise<void> {
		return Promise.resolve();
	}
	async destroy(): Promise<void>{
		return Promise.resolve();
	}

	async storeNewSettlementBatchAccount(account: ISettlementBatchAccountDto): Promise<void> {
		if (account === undefined) return Promise.resolve();
		this.batchAccounts.push(account);
		return Promise.resolve();
	}

	async accountExistsById(accountId: string): Promise<boolean> {
		if (accountId === undefined || accountId.trim() === '') return Promise.resolve(false);

		for (const batchAccIter of this.batchAccounts) {
			if (batchAccIter.id === accountId) return Promise.resolve(true);
		}

		return Promise.resolve(false);
	}

	async getAccountById(accountId: string): Promise<ISettlementBatchAccountDto | null> {
		if (accountId === undefined || accountId.trim() === '') return Promise.resolve(null);
		for (const batchAccIter of this.batchAccounts) {
			if (batchAccIter.id === accountId) return Promise.resolve(batchAccIter);
		}

		return Promise.resolve(null);
	}

	async getAccountByParticipantAccountAndBatchId(partAccId: string, batchId: string): Promise<ISettlementBatchAccountDto | null> {
		if (partAccId === undefined || partAccId.trim() === '') return Promise.resolve(null);
		if (batchId === undefined || batchId.trim() === '') return Promise.resolve(null);
		for (const batchAccIter of this.batchAccounts) {
			if (batchAccIter.settlementBatch === null || batchAccIter.settlementBatch === undefined) continue;
			if (batchAccIter.participantAccountId === partAccId && batchAccIter.settlementBatch!.id === batchId) {
				return Promise.resolve(batchAccIter);
			}
		}

		return Promise.resolve(null);
	}

	async getAccountsByParticipantAccountId(participantAccountId: string): Promise<ISettlementBatchAccountDto[]> {
		let returnVal : Array<ISettlementBatchAccountDto> = [];
		if (participantAccountId === undefined || participantAccountId.trim() === '') return Promise.resolve(returnVal);

		for (const batchAccIter of this.batchAccounts) {
			if (batchAccIter.participantAccountId === participantAccountId) returnVal.push(batchAccIter);
		}

		return Promise.resolve(returnVal);
	}

	async getAccountsByBatch(batch: ISettlementBatchDto): Promise<ISettlementBatchAccountDto[]> {
		let returnVal : Array<ISettlementBatchAccountDto> = [];
		if (batch === undefined || batch.id === undefined) return Promise.resolve(returnVal);

		for (const batchAccIter of this.batchAccounts) {
			if (batchAccIter.settlementBatch === null) continue;
			if (batch.id === batchAccIter.settlementBatch!.id) returnVal.push(batchAccIter);
		}
		return Promise.resolve(returnVal);
	}

	async updateAccountCreditBalanceAndTimestampById(
		accountId: string,
		creditBalance: string,
		timeStamp: number
	): Promise<void> {
		if (accountId === undefined || creditBalance === undefined) return Promise.resolve();

		const accById = await this.getAccountById(accountId);
		if (accById == null) return Promise.resolve();

		accById.timestamp = timeStamp;
		accById.creditBalance = creditBalance;

		return Promise.resolve();
	}

	async updateAccountDebitBalanceAndTimestampById(
		accountId: string,
		debitBalance: string,
		timeStamp: number
	): Promise<void> {
		if (accountId === undefined || debitBalance === undefined) return Promise.resolve();

		const accById = await this.getAccountById(accountId);
		if (accById == null) return Promise.resolve();

		accById.timestamp = timeStamp;
		accById.debitBalance = debitBalance;

		return Promise.resolve();
	}
}
