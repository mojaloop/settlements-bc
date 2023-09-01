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
import { ISettlementConfig } from "@mojaloop/settlements-bc-public-types-lib";
import { InvalidSettlementModelError } from "../types/errors";

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
	msgTopic: string = SettlementsBCTopics.Commands;
	payload: ProcessTransferCmdPayload;

	constructor(payload: ProcessTransferCmdPayload) {
		super();
		this.aggregateId = this.msgKey = payload.transferId;
		this.payload = payload;
	}

	validatePayload(): void {
		// TODO @jason complete...
	}
}

export type CreateSettlementModelCmdPayload = {
	id: string;
	settlementModel: string;
	batchCreateInterval: number;
	createdBy: string;
}

export class CreateSettlementModelCmd extends CommandMsg {
	boundedContextName: string = SETTLEMENTS_BOUNDED_CONTEXT_NAME;
	aggregateId: string;
	aggregateName: string = SETTLEMENTS_AGGREGATE_NAME;
	msgKey: string;
	msgTopic: string = SettlementsBCTopics.Commands;
	payload: CreateSettlementModelCmdPayload;

	constructor(settlementModelPayload: CreateSettlementModelCmdPayload) {
		super();

		this.aggregateId = this.msgKey = settlementModelPayload.id;
		this.payload = settlementModelPayload;
	}

	validatePayload(): void {
		if(!this.payload){
			throw new InvalidSettlementModelError("Invalid settlement model payload");
		}
	}
}

export type CreateDynamicMatrixCmdPayload = {
	matrixId: string;
	fromDate: number;
	toDate: number;
	currencyCodes: string[];
	settlementModels: string[];
	batchStatuses: string[];
}


export class CreateDynamicMatrixCmd extends CommandMsg {
	boundedContextName: string = SETTLEMENTS_BOUNDED_CONTEXT_NAME;
	aggregateId: string;
	aggregateName: string = SETTLEMENTS_AGGREGATE_NAME;
	msgKey: string;
	msgTopic: string = SettlementsBCTopics.Commands;
	payload: CreateDynamicMatrixCmdPayload;

	constructor(payload: CreateDynamicMatrixCmdPayload) {
		super();

		this.aggregateId = this.msgKey = payload.matrixId;
		this.payload = payload;
	}

	validatePayload(): void {
		// TODO @jason complete...
	}
}

export type CreateStaticMatrixCmdPayload = {
	matrixId: string;
	batchIds: string[];
}

export class CreateStaticMatrixCmd extends CommandMsg {
	boundedContextName: string = SETTLEMENTS_BOUNDED_CONTEXT_NAME;
	aggregateId: string;
	aggregateName: string = SETTLEMENTS_AGGREGATE_NAME;
	msgKey: string;
	msgTopic: string = SettlementsBCTopics.Commands;
	payload: CreateStaticMatrixCmdPayload;

	constructor(payload: CreateStaticMatrixCmdPayload) {
		super();
		this.aggregateId = this.msgKey = payload.matrixId;
		this.payload = payload;
	}

	validatePayload(): void {
		// TODO Need to ensure the following is set;
		// TODO payload
		// TODO payload.matrixId is not blank
		// TODO payload.batchIds is not empty
	}
}

export type RecalculateMatrixCmdPayload = {
	matrixId: string;
}

export class RecalculateMatrixCmd extends CommandMsg {
	boundedContextName: string = SETTLEMENTS_BOUNDED_CONTEXT_NAME;
	aggregateId: string;
	aggregateName: string = SETTLEMENTS_AGGREGATE_NAME;
	msgKey: string;
	msgTopic: string = SettlementsBCTopics.Commands;
	payload: RecalculateMatrixCmdPayload;

	constructor(payload: RecalculateMatrixCmdPayload) {
		super();
		this.aggregateId = this.msgKey = payload.matrixId;
		this.payload = payload;
	}

	validatePayload(): void {
		// TODO @jason complete...
	}
}

export type CloseMatrixCmdPayload = {
	matrixId: string;
}

export class CloseMatrixCmd extends CommandMsg {
	boundedContextName: string = SETTLEMENTS_BOUNDED_CONTEXT_NAME;
	aggregateId: string;
	aggregateName: string = SETTLEMENTS_AGGREGATE_NAME;
	msgKey: string;
	msgTopic: string = SettlementsBCTopics.Commands;
	payload: CloseMatrixCmdPayload;

	constructor(payload: CloseMatrixCmdPayload) {
		super();
		this.aggregateId = this.msgKey = payload.matrixId;
		this.payload = payload;
	}

	validatePayload(): void {
		// TODO @jason complete...
	}
}

export type SettleMatrixCmdPayload = {
	matrixId: string;
}

export class SettleMatrixCmd extends CommandMsg {
	boundedContextName: string = SETTLEMENTS_BOUNDED_CONTEXT_NAME;
	aggregateId: string;
	aggregateName: string = SETTLEMENTS_AGGREGATE_NAME;
	msgKey: string;
	msgTopic: string = SettlementsBCTopics.Commands;
	payload: SettleMatrixCmdPayload;

	constructor(payload: SettleMatrixCmdPayload) {
		super();
		this.aggregateId = this.msgKey = payload.matrixId;
		this.payload = payload;
	}

	validatePayload(): void {
		// TODO @jason complete...
	}
}

export type DisputeMatrixCmdPayload = {
	matrixId: string;
}

export class DisputeMatrixCmd extends CommandMsg {
	boundedContextName: string = SETTLEMENTS_BOUNDED_CONTEXT_NAME;
	aggregateId: string;
	aggregateName: string = SETTLEMENTS_AGGREGATE_NAME;
	msgKey: string;
	msgTopic: string = SettlementsBCTopics.Commands;
	payload: DisputeMatrixCmdPayload;

	constructor(payload: DisputeMatrixCmdPayload) {
		super();
		this.aggregateId = this.msgKey = payload.matrixId;
		this.payload = payload;
	}

	validatePayload(): void {
		// TODO @jason complete...
	}
}

export type LockMatrixCmdPayload = {
	matrixId: string;
}

export class LockMatrixCmd extends CommandMsg {
	boundedContextName: string = SETTLEMENTS_BOUNDED_CONTEXT_NAME;
	aggregateId: string;
	aggregateName: string = SETTLEMENTS_AGGREGATE_NAME;
	msgKey: string;
	msgTopic: string = SettlementsBCTopics.Commands;
	payload: LockMatrixCmdPayload;

	constructor(payload: LockMatrixCmdPayload) {
		super();
		this.aggregateId = this.msgKey = payload.matrixId;
		this.payload = payload;
	}

	validatePayload(): void {
		// TODO @jason complete...
	}
}

export type UnlockMatrixCmdPayload = {
	matrixId: string;
}

export class UnlockMatrixCmd extends CommandMsg {
	boundedContextName: string = SETTLEMENTS_BOUNDED_CONTEXT_NAME;
	aggregateId: string;
	aggregateName: string = SETTLEMENTS_AGGREGATE_NAME;
	msgKey: string;
	msgTopic: string = SettlementsBCTopics.Commands;
	payload: UnlockMatrixCmdPayload;

	constructor(payload: UnlockMatrixCmdPayload) {
		super();
		this.aggregateId = this.msgKey = payload.matrixId;
		this.payload = payload;
	}

	validatePayload(): void {
		// TODO @jason complete...
	}
}

export type AddBatchesToMatrixCmdPayload = {
	matrixId: string;
	batchIds: string[];
}

export class AddBatchesToMatrixCmd extends CommandMsg {
	boundedContextName: string = SETTLEMENTS_BOUNDED_CONTEXT_NAME;
	aggregateId: string;
	aggregateName: string = SETTLEMENTS_AGGREGATE_NAME;
	msgKey: string;
	msgTopic: string = SettlementsBCTopics.Commands;
	payload: AddBatchesToMatrixCmdPayload;

	constructor(payload: AddBatchesToMatrixCmdPayload) {
		super();

		this.aggregateId = this.msgKey = payload.matrixId;
		this.payload = payload;
	}

	validatePayload(): void {
		// TODO @jason complete...
	}
}

export type RemoveBatchesFromMatrixCmdPayload = {
	matrixId: string;
	batchIds: string[];
}

export class RemoveBatchesFromMatrixCmd extends CommandMsg {
	boundedContextName: string = SETTLEMENTS_BOUNDED_CONTEXT_NAME;
	aggregateId: string;
	aggregateName: string = SETTLEMENTS_AGGREGATE_NAME;
	msgKey: string;
	msgTopic: string = SettlementsBCTopics.Commands;
	payload: RemoveBatchesFromMatrixCmdPayload;

	constructor(payload: RemoveBatchesFromMatrixCmdPayload) {
		super();

		this.aggregateId = this.msgKey = payload.matrixId;
		this.payload = payload;
	}

	validatePayload(): void {
		// TODO @jason complete...
	}
}

export type MarkMatrixOutOfSyncCmdPayload = {
	originMatrixId: string;
	batchIds: string[];
}

export class MarkMatrixOutOfSyncCmd extends CommandMsg {
	boundedContextName: string = SETTLEMENTS_BOUNDED_CONTEXT_NAME;
	aggregateId: string;
	aggregateName: string = SETTLEMENTS_AGGREGATE_NAME;
	msgKey: string;
	msgTopic: string = SettlementsBCTopics.Commands;
	payload: MarkMatrixOutOfSyncCmdPayload;

	constructor(payload: MarkMatrixOutOfSyncCmdPayload) {
		super();
		this.aggregateId = this.msgKey = payload.originMatrixId;
		this.payload = payload;
	}

	validatePayload(): void {
		// TODO @jason complete...
	}
}
