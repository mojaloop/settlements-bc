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

import {IParticipantAccountBatchMappingRepo} from "@mojaloop/settlements-bc-domain-lib";
import {IParticipantAccountBatchMappingDto} from "@mojaloop/settlements-bc-public-types-lib";

export class ParticipantAccountRepoMock implements IParticipantAccountBatchMappingRepo {
	participants: Array<IParticipantAccountBatchMappingDto> = [];

	async init(): Promise<void> {
		return Promise.resolve();
	}
	async destroy(): Promise<void>{
		return Promise.resolve();
	}

	async storeBatchParticipant(participant: IParticipantAccountBatchMappingDto): Promise<void> {
		if (participant === undefined) return Promise.resolve();
		this.participants.push(participant);
		return Promise.resolve();
	}

	async getAccountBy(participantId: string, batchId: string): Promise<IParticipantAccountBatchMappingDto | null> {
		if (participantId === undefined || batchId === undefined) return Promise.resolve(null);

		for (const partIter of this.participants) {
			if (partIter.participantId === participantId && batchId === partIter.settlementBatchId) {
				return Promise.resolve(partIter);
			}
		}
		return Promise.resolve(null);
	}

	async publishSettlementNotification(accounts: IParticipantAccountBatchMappingDto[]): Promise<void> {
		//TODO publish to the external system:
		return Promise.resolve();
	}


}
