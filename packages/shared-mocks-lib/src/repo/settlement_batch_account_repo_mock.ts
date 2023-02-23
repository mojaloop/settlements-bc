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

import {IAccountsBalancesAdapter, ISettlementBatchAccountRepo} from "@mojaloop/settlements-bc-domain-lib";
import {ISettlementBatchAccountDto, ISettlementBatchDto} from "@mojaloop/settlements-bc-public-types-lib";

export class SettlementBatchAccountRepoMock implements ISettlementBatchAccountRepo {
	batchAccounts: Array<ISettlementBatchAccountDto> = [];

	async init(): Promise<void> {
		return Promise.resolve();
	}
	async destroy(): Promise<void>{
		return Promise.resolve();
	}

	async storeNewSettlementBatchAccount(account: ISettlementBatchAccountDto, abAdapter: IAccountsBalancesAdapter): Promise<void> {
		if (account === undefined) return Promise.resolve();

		await abAdapter.createAccount(
			account.id!,
			account.participantAccountId!,
			'SETTLEMENT',
			account.currencyCode
		);
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

	async getAccountById(accountId: string, abAdapter?: IAccountsBalancesAdapter): Promise<ISettlementBatchAccountDto | null> {
		if (accountId === undefined || accountId.trim() === '') return Promise.resolve(null);
		for (const batchAccIter of this.batchAccounts) {
			if (batchAccIter.id === accountId) {
				return Promise.resolve(await this.addBalancesUsingABAdapter(batchAccIter));
			}
		}

		return Promise.resolve(null);
	}

	async getAccountByParticipantAccountAndBatchId(
		partAccId: string,
		batchId: string,
		abAdapter?: IAccountsBalancesAdapter
	): Promise<ISettlementBatchAccountDto | null> {
		if (partAccId === undefined || partAccId.trim() === '') return Promise.resolve(null);
		if (batchId === undefined || batchId.trim() === '') return Promise.resolve(null);
		for (const batchAccIter of this.batchAccounts) {
			if (batchAccIter.settlementBatch === null || batchAccIter.settlementBatch === undefined) continue;
			if (batchAccIter.participantAccountId === partAccId && batchAccIter.settlementBatch!.id === batchId) {
				return Promise.resolve(await this.addBalancesUsingABAdapter(batchAccIter));
			}
		}

		return Promise.resolve(null);
	}

	async getAccountsByParticipantAccountId(
		participantAccountId: string,
		abAdapter?: IAccountsBalancesAdapter
	): Promise<ISettlementBatchAccountDto[]> {
		let returnVal : Array<ISettlementBatchAccountDto> = [];
		if (participantAccountId === undefined || participantAccountId.trim() === '') return Promise.resolve(returnVal);

		for (const batchAccIter of this.batchAccounts) {
			if (batchAccIter.participantAccountId === participantAccountId) {
				returnVal.push(await this.addBalancesUsingABAdapter(batchAccIter));
			}
		}

		return Promise.resolve(returnVal);
	}

	async getAccountsByBatch(
		batch: ISettlementBatchDto,
		abAdapter?: IAccountsBalancesAdapter
	): Promise<ISettlementBatchAccountDto[]> {
		let returnVal : Array<ISettlementBatchAccountDto> = [];
		if (batch === undefined || batch.id === undefined) return Promise.resolve(returnVal);

		for (const batchAccIter of this.batchAccounts) {
			if (batchAccIter.settlementBatch === null) continue;
			if (batch.id === batchAccIter.settlementBatch!.id) {
				returnVal.push(await this.addBalancesUsingABAdapter(batchAccIter));
			}
		}
		return Promise.resolve(returnVal);
	}

	private async addBalancesUsingABAdapter(
		returnVal : ISettlementBatchAccountDto,
		abAdapter?: IAccountsBalancesAdapter
	) : Promise<ISettlementBatchAccountDto> {
		if (abAdapter === undefined || abAdapter === null) 	return Promise.resolve(returnVal);

		const accFromAccBal = await abAdapter.getAccount(returnVal.id!);
		let debitBal = returnVal.debitBalance;
		let creditBal = returnVal.creditBalance;
		if (accFromAccBal !== null && accFromAccBal !== undefined) {
			if (accFromAccBal.postedDebitBalance !== null && accFromAccBal.postedDebitBalance !== undefined) {
				debitBal = accFromAccBal.postedDebitBalance;
			}
			if (accFromAccBal.postedCreditBalance !== null && accFromAccBal.postedCreditBalance !== undefined) {
				creditBal = accFromAccBal.postedCreditBalance;
			}
		}

		return Promise.resolve({
			id: returnVal.id,
			participantAccountId: returnVal.participantAccountId,
			currencyCode: returnVal.currencyCode,
			currencyDecimals: returnVal.currencyDecimals,
			creditBalance: creditBal,
			debitBalance: debitBal,
			timestamp: returnVal.timestamp
		});
	}

}
