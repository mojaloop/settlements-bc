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

*  - Jason Bruwer <jason.bruwer@coil.com>
*****/

"use strict";

import {
	ISettlementBatch,
	ISettlementBatchAccount,
	SettlementMatrixBatchState
} from "@mojaloop/settlements-bc-public-types-lib";

export class SettlementBatch implements ISettlementBatch {
	batchUUID: string;
	id: string; // FX.XOF:RWF.2021.08.23.00.00.001
	timestamp: number;
	settlementModel: string;
	currencyCode: string;
	batchName: string; // FX.XOF:RWF.2021.08.23.00.00 (minus seq)
	batchSequence: number; // 1 (seq only)
	state: SettlementMatrixBatchState;

	// this will only exist for batches that are in a state that mandates a
	// single matrix owning it, like "AWAITING_SETTLEMENT" or "SETTLED"
	// when locking or settling, put matrixId, when unlocking put it to null again
	ownerMatrixId: null | string;

	accounts: ISettlementBatchAccount[];

	constructor(
		batchUUID: string,
		id: string,
		timestamp: number,
		settlementModel: string,
		currencyCode: string,
		batchSequence: number,
		batchName: string,
		state: "OPEN" | "DISPUTED" | "SETTLED",
		accounts?: ISettlementBatchAccount[],
	) {
		this.batchUUID = batchUUID;
		this.id = id;
		this.timestamp = timestamp;
		this.settlementModel = settlementModel;
		this.currencyCode = currencyCode;
		this.batchName = batchName;
		this.batchSequence = batchSequence;
		this.state = state;
		this.accounts = accounts ?? [];
	}

	addAccount(accountExtId: string, participantId: string, currencyCode: string) {
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
