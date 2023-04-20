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
	ISettlementBatch,
	ISettlementBatchAccount,
	ISettlementBatchTransfer
} from "@mojaloop/settlements-bc-public-types-lib";


/*

Future batch states:
- open - can have more transfers allocated to it
- closed - cannot have more transfers allocated to it (might be from matrix close command, or
- settled - was settled with a parent matrix (settle matrix command)
- disputed - closed and marked as in dispute

*/

export class SettlementBatch implements ISettlementBatch {
	id: string; // FX.XOF:RWF.2021.08.23.00.00.001
	timestamp: number;
	settlementModel: string;
	currencyCode: string;
	batchName: string; // FX.XOF:RWF.2021.08.23.00.00 (minus seq)
	batchSequence: number; // 1 (seq only)
	state: "OPEN" | "DISPUTED" | "SETTLED" | "CLOSED";

	accounts: ISettlementBatchAccount[];

	constructor(
		id: string,
		timestamp: number,
		settlementModel: string,
		currencyCode: string,
		batchSequence: number,
		batchName: string,
		state: "OPEN" | "DISPUTED" | "SETTLED",
		accounts?: ISettlementBatchAccount[],
	) {
		this.id = id;
		this.timestamp = timestamp;
		this.settlementModel = settlementModel;
		this.currencyCode = currencyCode;
		this.batchName = batchName;
		this.batchSequence = batchSequence;
		this.state = state;
		this.accounts = accounts ?? [];
	}

	addAccount(accountExtId: string, participantId:string, currencyCode:string) {
		this.accounts.push({
			accountExtId: accountExtId,
			participantId: participantId,
			currencyCode: currencyCode,
			debitBalance: "0",
			creditBalance: "0",
		});
	}

	getAccount(participantId : string, currencyCode : string): ISettlementBatchAccount | null {
		if (!participantId || !participantId)
			throw new Error("invalid participantId or currencyCode in SettlementBatch.getAccount()");
		const found = this.accounts.find(value => value.participantId === participantId && value.currencyCode === currencyCode);
		return found || null;
	}

}
