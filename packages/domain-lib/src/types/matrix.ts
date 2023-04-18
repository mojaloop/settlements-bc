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
  ISettlementMatrixParticipantBalance

} from "@mojaloop/settlements-bc-public-types-lib";
import {randomUUID} from "crypto";
import {CurrencyCodesDifferError} from "./errors";

export class SettlementMatrix implements ISettlementMatrix {
  id: string;
  createdAt: number;
  updatedAt: number;

  dateFrom: number | null;
  dateTo: number | null;
  currencyCode: string;
  settlementModel: string | null;

  batches: ISettlementMatrixBatch[];
  participantBalances: ISettlementMatrixParticipantBalance[];

  state: "IDLE" | "BUSY" | "DISPUTED" | "CLOSED" | "SETTLED";
  type: "STATIC" | "DYNAMIC"

  generationDurationSecs: number | null;
  totalDebitBalance: string;
  totalCreditBalance: string;

  protected constructor(type: "STATIC" | "DYNAMIC", currency: string) {
    this.id = randomUUID();
    this.createdAt = this.updatedAt = Date.now();
    this.dateFrom = null;
    this.dateTo = null;
    this.currencyCode = currency;
    this.settlementModel = null;

    this.state = "IDLE";
    this.type = type;

    this.batches  = [];
    this.participantBalances = [];
    this.totalDebitBalance = "0";
    this.totalCreditBalance = "0";
  }

  addBatch(batch: ISettlementBatch, debitBalance: string, creditBalance: string): void {
    if (this.type === 'STATIC' && this.batches.length === 0) {
      this.currencyCode = batch.currencyCode;
    }

    if (batch.currencyCode !== this.currencyCode) {
      throw new CurrencyCodesDifferError(`Matrix expects '${this.currencyCode}' but was '${batch.currencyCode}'`);
    }

    this.batches.push({
      id: batch.id,
      name: batch.batchName,
      batchDebitBalance: debitBalance,
      batchCreditBalance: creditBalance,
      state: batch.state,
    });
  }

  removeBatch(batch: ISettlementBatch): void {
    this.batches = this.batches.filter(itm => itm.id !== batch.id)
  }

  clear(){
    this.batches = [];
    this.participantBalances = [];
    this.totalDebitBalance = "0";
    this.totalCreditBalance = "0";
  }

  static CreateStatic(currency: string): SettlementMatrix {
    return new SettlementMatrix("STATIC", currency);
  }

  static CreateDynamic(
    dateFrom: number | null,
    dateTo: number | null,
    currencyCode: string,
    settlementModel: string | null
  ) : SettlementMatrix {
    const newInstance = new SettlementMatrix("DYNAMIC", currencyCode);
    newInstance.dateFrom = dateFrom;
    newInstance.dateTo = dateTo;
    newInstance.settlementModel = settlementModel;
    return newInstance;
  }

  static CreateFromDto(dto: ISettlementMatrix): SettlementMatrix {
    const newInstance = new SettlementMatrix(dto.type, dto.currencyCode);

    newInstance.id = dto.id;
    newInstance.createdAt = dto.createdAt;
    newInstance.updatedAt = dto.updatedAt;
    newInstance.state = dto.state;

    newInstance.dateFrom = dto.dateFrom;
    newInstance.dateTo = dto.dateTo;
    newInstance.settlementModel = dto.settlementModel;

    newInstance.batches = dto.batches;
    newInstance.participantBalances = dto.participantBalances;

    newInstance.generationDurationSecs = dto.generationDurationSecs;
    newInstance.totalDebitBalance = dto.totalDebitBalance;
    newInstance.totalCreditBalance = dto.totalCreditBalance;

    return newInstance;
  }
}
