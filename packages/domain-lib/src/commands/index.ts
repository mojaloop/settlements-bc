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

 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Crosslake
 - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 --------------
 ******/

"use strict";

import {CommandMsg} from "@mojaloop/platform-shared-lib-messaging-types-lib";
import {
	SETTLEMENTS_BOUNDED_CONTEXT_NAME,
	SETTLEMENTS_AGGREGATE_NAME,
	SettlementsBCTopics
} from "@mojaloop/platform-shared-lib-public-messages-lib";


export type ProcessTransferCmdPayload = {
	transferId: string;
	amount: string;
	currencyCode: string;
	payerFspId: string;
	payeeFspId: string;
	completedTimestamp: number;
	settlementModel: string;
}

export class ProcessTransferCmd extends CommandMsg {
	boundedContextName: string = SETTLEMENTS_BOUNDED_CONTEXT_NAME;
	aggregateId: string;
	aggregateName: string = SETTLEMENTS_AGGREGATE_NAME;
	msgKey: string;
	msgTopic: string = SettlementsBCTopics.DomainRequests;
	payload: ProcessTransferCmdPayload;

	constructor(payload: ProcessTransferCmdPayload) {
		super();

		this.aggregateId = this.msgKey = payload.transferId;
		this.payload = payload;
	}

	validatePayload(): void {
		// TODO
	}
}