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

import {ISettlementBatchTransfer} from "@mojaloop/settlements-bc-public-types-lib";

export class SettlementBatchTransfer implements ISettlementBatchTransfer {
	transferId: string;
	transferTimestamp: number;
	payerFspId: string;
	payeeFspId: string;
	currencyCode: string;
	amount: string;
	batchId: string;
	batchName: string;
	journalEntryId: string | null;
	matrixId: string | null;

	constructor(
		transferId: string,
		transferTimestamp: number,
		payerFspId: string,
		payeeFspId: string,
		currencyCode: string,
		amount: string,
		batchId: string,
		batchName: string,
		journalEntryId: string | null = null, // Not yet accounted/in a&b will have this as a null
		matrixId: string | null = null
	) {
		this.transferId = transferId;
		this.transferTimestamp = transferTimestamp;
		this.payerFspId = payerFspId;
		this.payeeFspId = payeeFspId;
		this.currencyCode = currencyCode;
		this.amount = amount;
		this.batchId = batchId;
		this.batchName = batchName;
		this.journalEntryId = journalEntryId;
		this.matrixId = matrixId;
	}
}
