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

import {IAccountsBalancesAdapter, ISettlementTransferRepo} from "@mojaloop/settlements-bc-domain-lib";
import {ISettlementTransferDto} from "@mojaloop/settlements-bc-public-types-lib";

export class SettlementTransferRepoMock implements ISettlementTransferRepo {

	async init(): Promise<void> {
		return Promise.resolve();
	}
	async destroy(): Promise<void>{
		return Promise.resolve();
	}

	async storeNewSettlementTransfer(transfer: ISettlementTransferDto, abAdapter: IAccountsBalancesAdapter): Promise<void> {
		if (transfer === undefined) return Promise.resolve();

		await abAdapter.createJournalEntry(
			transfer.id!,
			transfer.transferId!,
			transfer.currencyCode,
			transfer.amount,
			false,
			transfer.debitParticipantAccountId,
			transfer.creditParticipantAccountId
		);

		return Promise.resolve();
	}

	async getSettlementTransfersByAccountId(accountId: string, abAdapter: IAccountsBalancesAdapter): Promise<ISettlementTransferDto[]> {
		let returnVal : Array<ISettlementTransferDto> = [];
		if (accountId === undefined || accountId.trim() === '') return Promise.resolve(returnVal);

		const jourEntries = await abAdapter.getJournalEntriesByAccountId(accountId);

		for (const transferIter of jourEntries) {
			returnVal.push({
				id: transferIter.id,
				transferId: transferIter.ownerId,
				currencyCode: transferIter.currencyCode,
				currencyDecimals: 2,
				amount: transferIter.amount,
				debitParticipantAccountId: transferIter.debitedAccountId,
				creditParticipantAccountId: transferIter.creditedAccountId,
				timestamp: transferIter.timestamp!,
				settlementModel: ''
			});
		}
		return Promise.resolve(returnVal);
	}

	async getSettlementTransfersByAccountIds(accountIds: string[], abAdapter: IAccountsBalancesAdapter): Promise<ISettlementTransferDto[]> {
		let returnVal : Array<ISettlementTransferDto> = [];
		if (accountIds === undefined || accountIds.length === 0) return Promise.resolve(returnVal);

		for (const accId of accountIds) {
			const results = await this.getSettlementTransfersByAccountId(accId, abAdapter);
			results.forEach(itm => returnVal.push(itm));
		}

		return Promise.resolve(returnVal);
	}
}
