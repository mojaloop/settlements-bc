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
  ISettlementMatrixBalanceByCurrency,
  ISettlementMatrixBalanceByStateAndCurrency,
  ISettlementMatrixBalanceByParticipant,
  SettlementMatrixBatchState,
  ISettlementBatchTransfer
} from "@mojaloop/settlements-bc-public-types-lib";
import {randomUUID} from "crypto";
import {bigintToString, stringToBigint} from "../converters";
import { Currency } from "@mojaloop/platform-configuration-bc-public-types-lib";

export class SettlementMatrix implements ISettlementMatrix {
  id: string;
  createdAt: number;
  updatedAt: number;

  dateFrom: number | null;
  dateTo: number | null;
  currencyCodes: string[];
  settlementModel: string | null;
  batchStatuses: string[];

  // multiple matrices can have the same batch, this can only be used to find a matrix batch
  // to find the actual owner of a batch, use the batch.ownerMatrixId
  batches: ISettlementMatrixBatch[];

  state: "IDLE" | "BUSY" | "FINALIZED" | "OUT_OF_SYNC"| "LOCKED";
  type: "STATIC" | "DYNAMIC";

  generationDurationSecs: number | null;

  balancesByCurrency: ISettlementMatrixBalanceByCurrency[];
  balancesByStateAndCurrency: ISettlementMatrixBalanceByStateAndCurrency[];
  balancesByParticipant: ISettlementMatrixBalanceByParticipant[];

  protected constructor(type: "STATIC" | "DYNAMIC") {
    this.id = randomUUID();
    this.createdAt = this.updatedAt = Date.now();
    this.dateFrom = null;
    this.dateTo = null;
    this.currencyCodes = [];
    this.settlementModel = null;
    this.batchStatuses = [];

    this.state = "IDLE";
    this.type = type;

    this.batches  = [];
    this.balancesByParticipant = [];
    this.balancesByCurrency = [];
    this.balancesByStateAndCurrency = [];
  }

  addBalance(
    batchTransfer:ISettlementBatchTransfer,
    currency: Currency,
    state: SettlementMatrixBatchState,
  ): void {
    if(!this.balancesByParticipant) this.balancesByParticipant =[];
    if(!this.balancesByCurrency) this.balancesByCurrency =[];
    if(!this.balancesByStateAndCurrency) this.balancesByStateAndCurrency =[];

    const currencyCode = currency.code;
    const currencyDecimals = currency.decimals;

    const participantIdsList = [batchTransfer.payerFspId, batchTransfer.payeeFspId];

    for (const participantId of participantIdsList) {
      const debitBalance = participantId === batchTransfer.payerFspId ? stringToBigint(batchTransfer.amount, currencyDecimals) : 0n;
      const creditBalance = participantId === batchTransfer.payeeFspId ? stringToBigint(batchTransfer.amount, currencyDecimals) : 0n;
      
      // byParticipant
      const byParticipant = this.balancesByParticipant.find(value =>
          value.state === state && value.currencyCode === currencyCode && value.participantId === participantId);
      if (byParticipant) {
        byParticipant.debitBalance = bigintToString(
            stringToBigint(byParticipant.debitBalance, currencyDecimals) + debitBalance,
            currencyDecimals
        );
        byParticipant.creditBalance = bigintToString(
            stringToBigint(byParticipant.creditBalance, currencyDecimals) + creditBalance,
            currencyDecimals
        );
      }else {
        this.balancesByParticipant.push({
          participantId: participantId,
          state: state,
          currencyCode: currencyCode,
          debitBalance: bigintToString(debitBalance, currencyDecimals),
          creditBalance: bigintToString(creditBalance, currencyDecimals)
        });
      }

      // byCurrency
      const byCurrency = this.balancesByCurrency.find(value => value.currencyCode === currencyCode);
      if (byCurrency) {
        byCurrency.debitBalance = bigintToString(
            stringToBigint(byCurrency.debitBalance, currencyDecimals) + debitBalance,
            currencyDecimals
        );
        byCurrency.creditBalance = bigintToString(
            stringToBigint(byCurrency.creditBalance, currencyDecimals) + creditBalance,
            currencyDecimals
        );
      }else{
        this.balancesByCurrency.push({
          currencyCode: currencyCode,
          debitBalance: bigintToString(debitBalance, currencyDecimals),
          creditBalance: bigintToString(creditBalance, currencyDecimals)
        });
      }


      // byStateAndCurrency
      const byStateAndCurrency = this.balancesByStateAndCurrency.find(
          value =>  value.state === state && value.currencyCode === currencyCode);
      if (byStateAndCurrency) {
        byStateAndCurrency.debitBalance = bigintToString(
            stringToBigint(byStateAndCurrency.debitBalance, currencyDecimals) + debitBalance,
            currencyDecimals
        );
        byStateAndCurrency.creditBalance = bigintToString(
            stringToBigint(byStateAndCurrency.creditBalance, currencyDecimals) + creditBalance,
            currencyDecimals
        );
      }else{
        this.balancesByStateAndCurrency.push({
          state: state,
          currencyCode: currencyCode,
          debitBalance: bigintToString(debitBalance, currencyDecimals),
          creditBalance: bigintToString(creditBalance, currencyDecimals)
        });
      }
    }

  }

 /* addParticipantBalance(
      currencyCode: string,
      participantId: string,
      state: string,
      debitBalance: string,
      creditBalance: string
  ): void {
    this.participantBalances.push({
      participantId,
      currencyCode,
      state,
      debitBalance,
      creditBalance
    });
  }*/

  addBatch(
    batch: ISettlementBatch,
    debitBalance: string,
    creditBalance: string
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
    this.balancesByParticipant = [];
    this.balancesByCurrency = [];
    this.balancesByStateAndCurrency = [];
  }

  static CreateStatic(): SettlementMatrix {
    return new SettlementMatrix("STATIC");
  }

  static CreateDynamic(
    dateFrom: number | null,
    dateTo: number | null,
    currencyCodes: string[],
    settlementModel: string,
    batchStatuses: string[]
  ) : SettlementMatrix {
    const newInstance = new SettlementMatrix("DYNAMIC");
    newInstance.dateFrom = dateFrom;
    newInstance.dateTo = dateTo;
    newInstance.settlementModel = settlementModel;
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
    newInstance.settlementModel = dto.settlementModel;
    newInstance.batchStatuses = dto.batchStatuses;

    newInstance.batches = dto.batches;
    newInstance.balancesByParticipant = dto.balancesByParticipant;

    newInstance.generationDurationSecs = dto.generationDurationSecs;
    newInstance.balancesByCurrency = dto.balancesByCurrency;
    newInstance.balancesByStateAndCurrency = dto.balancesByStateAndCurrency;

    return newInstance;
  }
}
