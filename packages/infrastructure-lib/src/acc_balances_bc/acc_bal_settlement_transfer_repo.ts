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

import {ISettlementTransferRepo} from "@mojaloop/settlements-bc-domain-lib";
import {ISettlementTransferDto} from "@mojaloop/settlements-bc-public-types-lib";
import console from "console";
import {AccountsAndBalancesBCSettlementBatchAccountRepo} from "./acc_bal_settlement_batch_account_repo";
export class AccountsAndBalancesBCSettlementTransferRepo implements ISettlementTransferRepo {

	async init(): Promise<void> {
		return Promise.resolve();
	}
	async destroy(): Promise<void>{
		return Promise.resolve();
	}

	async storeNewSettlementTransfer(transfer: ISettlementTransferDto): Promise<void> {
		if (transfer === undefined) return Promise.resolve();

		//TODO Complete this...
		
		return Promise.resolve();
	}

	async transferExistsById(id: string): Promise<boolean> {
		if (id === undefined || id.trim() === '') return Promise.resolve(false);

		//TODO Complete this...

		return Promise.resolve(false);
	}

	async getSettlementTransfersByAccountId(accountId: string): Promise<ISettlementTransferDto[]> {
		let returnVal : Array<ISettlementTransferDto> = [];
		if (accountId === undefined || accountId.trim() === '') return Promise.resolve(returnVal);

		//TODO Complete this...

		return Promise.resolve(returnVal);
	}

	async getSettlementTransfersByAccountIds(accountIds: string[]): Promise<ISettlementTransferDto[]> {
		let returnVal : Array<ISettlementTransferDto> = [];
		if (accountIds === undefined || accountIds.length === 0) return Promise.resolve(returnVal);

		//TODO Complete this...

		return Promise.resolve(returnVal);
	}
}
