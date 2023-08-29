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
  ISettlementMatrix,
  ISettlementMatrixBatch,
  ISettlementMatrixParticipantBalance, ISettlementMatrixTotalBalance

} from "@mojaloop/settlements-bc-public-types-lib";
import {randomUUID} from "crypto";
import {CurrencyCodesDifferError} from "./errors";

export class SettlementMatrix implements ISettlementMatrix {
  id: string;
  createdAt: number;
  updatedAt: number;

  dateFrom: number | null;
  dateTo: number | null;
  currencyCodes: string[];
  settlementModels: string[];
  batchStatuses: string[];

  // multiple matrices can have the same batch, this can only be used to find a matrix batch
  // to find the actual owner of a batch, use the batch.ownerMatrixId
  batches: ISettlementMatrixBatch[];
  participantBalances: ISettlementMatrixParticipantBalance[];

  state: "IDLE" | "BUSY" | "FINALIZED";
  type: "STATIC" | "DYNAMIC";

  generationDurationSecs: number | null;
  totalBalances: ISettlementMatrixTotalBalance[];
  isBatchesOutOfSync: boolean;

  protected constructor(type: "STATIC" | "DYNAMIC") {
    this.id = randomUUID();
    this.createdAt = this.updatedAt = Date.now();
    this.dateFrom = null;
    this.dateTo = null;
    this.currencyCodes = [];
    this.settlementModels = [];
    this.batchStatuses = [];

    this.state = "IDLE";
    this.type = type;

    this.batches  = [];
    this.participantBalances = [];
    this.totalBalances = [];
    this.isBatchesOutOfSync = false;
  }

  addTotalBalance(
      currencyCode: string,
      state: string,
      debitBalance: string = "0",
      creditBalance: string = "0"
  ): void {
    this.totalBalances.push({
      currencyCode,
      state,
      debitBalance,
      creditBalance
    });
  }

  addParticipantBalance(
      currencyCode: string,
      participantId: string,
      state: string,
      debitBalance: string = "0",
      creditBalance: string = "0"
  ): void {
    this.participantBalances.push({
      participantId,
      currencyCode,
      state,
      debitBalance,
      creditBalance
    });
  }

  addBatch(
    batch: ISettlementBatch,
    debitBalance: string = "0",
    creditBalance: string = "0"
  ): void {
    if (this.type === 'STATIC') this.currencyCodes = [];

    this.batches.push({
      id: batch.id,
      name: batch.batchName,
      currencyCode: batch.currencyCode,
      batchDebitBalance: debitBalance,
      batchCreditBalance: creditBalance,
      state: batch.state,
    });
  }

  removeBatchById(batchId: string):void{
    this.batches = this.batches.filter(itm => itm.id !== batchId);
  }

  removeBatch(batch: ISettlementBatch): void {
    this.batches = this.batches.filter(itm => itm.id !== batch.id);
  }

  clear(){
    this.batches = [];
    this.participantBalances = [];
    this.totalBalances = [];
  }

  static CreateStatic(currency: string): SettlementMatrix {
    return new SettlementMatrix("STATIC");
  }

  static CreateDynamic(
    dateFrom: number | null,
    dateTo: number | null,
    currencyCodes: string[],
    settlementModels: string[],
    batchStatuses: string[]
  ) : SettlementMatrix {
    const newInstance = new SettlementMatrix("DYNAMIC");
    newInstance.dateFrom = dateFrom;
    newInstance.dateTo = dateTo;
    newInstance.settlementModels = settlementModels;
    newInstance.batchStatuses = batchStatuses;
    newInstance.currencyCodes = currencyCodes;
    return newInstance;
  }

  static CreateFromDto(dto: ISettlementMatrix): SettlementMatrix {
    const newInstance = new SettlementMatrix(dto.type);

    newInstance.id = dto.id;
    newInstance.createdAt = dto.createdAt;
    newInstance.updatedAt = dto.updatedAt;
    newInstance.state = dto.state;
    newInstance.currencyCodes = dto.currencyCodes;

    newInstance.dateFrom = dto.dateFrom;
    newInstance.dateTo = dto.dateTo;
    newInstance.settlementModels = dto.settlementModels;
    newInstance.batchStatuses = dto.batchStatuses;

    newInstance.batches = dto.batches;
    newInstance.participantBalances = dto.participantBalances;

    newInstance.generationDurationSecs = dto.generationDurationSecs;
    newInstance.totalBalances = dto.totalBalances;
    newInstance.isBatchesOutOfSync = dto.isBatchesOutOfSync;

    return newInstance;
  }
}
