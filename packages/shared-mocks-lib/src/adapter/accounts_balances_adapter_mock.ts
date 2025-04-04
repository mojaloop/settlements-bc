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

* - Jason Bruwer <jason.bruwer@coil.com>
*****/

"use strict";

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {IAccountsBalancesAdapter, stringToBigint, bigintToString} from "@mojaloop/settlements-bc-domain-lib";
import {
	AccountsAndBalancesAccount,
	AccountsAndBalancesAccountType
} from "@mojaloop/accounts-and-balances-bc-public-types-lib";
import {AccountsAndBalancesJournalEntry} from "@mojaloop/accounts-and-balances-bc-public-types-lib";

class ABAccount {
	requestedId: string;
	ownerId: string;
	type: AccountsAndBalancesAccountType;
	currencyCode: string;
	pendingDebitBal: bigint;
	postedDebitBal: bigint;
	pendingCreditBal: bigint;
	postedCreditBal: bigint;

	constructor(requestedId: string, ownerId: string, type: AccountsAndBalancesAccountType, currencyCode: string) {
		this.requestedId = requestedId;
		this.ownerId = ownerId;
		this.type = type;
		this.currencyCode = currencyCode;
	}
}

class ABJournal {
	requestedId: string;
	ownerId: string;
	currencyCode: string;
	amount: string;
	pending: boolean;
	debitedAccountId: string;
	creditedAccountId: string;

	constructor(
		requestedId: string,
		ownerId: string,
		currencyCode: string,
		amount: string,
		pending: boolean,
		debitedAccountId: string,
		creditedAccountId: string
	) {
		this.requestedId = requestedId;
		this.ownerId = ownerId;
		this.currencyCode = currencyCode;
		this.amount = amount;
		this.pending = pending;
		this.debitedAccountId = debitedAccountId;
		this.creditedAccountId = creditedAccountId;
	}
}



export class AccountsBalancesAdapterMock implements IAccountsBalancesAdapter {
	abAccounts: Array<ABAccount> = [];
	abJournals: Array<ABJournal> = [];

	async init(): Promise<void> {
		return Promise.resolve();
	}
	async destroy(): Promise<void>{
		return Promise.resolve();
	}

	setToken(accessToken: string): void {
		// mock
	}

	setUserCredentials(client_id: string, username: string, password: string): void {
		// mock
	}

	setAppCredentials(client_id: string, client_secret: string): void {
		// mock
	}

	async createAccount(requestedId: string, ownerId: string, type: AccountsAndBalancesAccountType, currencyCode: string): Promise<string> {
		this.abAccounts.push(new ABAccount(requestedId, ownerId, type, currencyCode));
		return Promise.resolve(requestedId);
	}
	async getAccount(accountId: string): Promise<AccountsAndBalancesAccount | null> {
		for (const acc of this.abAccounts) {
			if (acc.requestedId === accountId) {
				const returnVal = this.convert(acc);
				return Promise.resolve(returnVal);
			}
		}
		return Promise.resolve(null);
	}

	async getAccounts(accountIds: string[]): Promise<AccountsAndBalancesAccount[]> {
		const returnVal :AccountsAndBalancesAccount[] = [];

		for (const accId of accountIds) {
			const lookup = await this.getAccount(accId);
			if (lookup == null) continue;
			returnVal.push(lookup);
		}
		return Promise.resolve(returnVal);
	}

	async getParticipantAccounts(participantId: string): Promise<AccountsAndBalancesAccount[]> {
		const returnVal :AccountsAndBalancesAccount[] = [];
		for (const acc of this.abAccounts) {
			if (acc.ownerId === participantId) {
				returnVal.push(this.convert(acc));
			}
		}
		return Promise.resolve(returnVal);
	}

	async createJournalEntries(
		entries: AccountsAndBalancesJournalEntry[]
	): Promise<{id: string, errorCode: number}[]> {
		const returnVal: {id: string, errorCode: number}[] = [];
		for (const entry of entries) {
			const amntAsBigInt = stringToBigint(entry.amount, 2);
			this.abJournals.push(
				new ABJournal(
					entry.id!,
					entry.ownerId!,
					entry.currencyCode,
					entry.amount,
					entry.pending,
					entry.debitedAccountId,
					entry.creditedAccountId
				)
			);
			// update the account balances:
			for (const acc of this.abAccounts) {
				if (acc.postedDebitBal === undefined) acc.postedDebitBal = 0n;
				if (acc.postedCreditBal === undefined) acc.postedCreditBal = 0n;

				if (acc.requestedId === entry.debitedAccountId) {
					acc.postedDebitBal += BigInt(amntAsBigInt);
				} else if (acc.requestedId === entry.creditedAccountId) {
					acc.postedCreditBal += BigInt(amntAsBigInt);
				}
			}
			returnVal.push({id: entry.id!, errorCode: 0});
		}
		return Promise.resolve(returnVal);
	}

	private convert(toConvert: ABAccount) : AccountsAndBalancesAccount {
		const returnVal : AccountsAndBalancesAccount = {
			id: toConvert.requestedId,
			ownerId: toConvert.ownerId,
			state: "ACTIVE",
			type: toConvert.type,
			currencyCode: toConvert.currencyCode,
			postedDebitBalance: toConvert.postedDebitBal === undefined ?
				'0' : bigintToString(toConvert.postedDebitBal, 2),
			pendingDebitBalance: toConvert.pendingDebitBal === undefined ?
				'0' : bigintToString(toConvert.pendingDebitBal, 2),
			postedCreditBalance: toConvert.postedCreditBal === undefined ?
				'0' : bigintToString(toConvert.postedCreditBal, 2),
			pendingCreditBalance: toConvert.pendingCreditBal === undefined ?
				'0' : bigintToString(toConvert.pendingCreditBal, 2),
			balance: '0',
			timestampLastJournalEntry: Date.now()
		};
		return returnVal;
	}

	private convertJournalEntry(toConvert: ABJournal) : AccountsAndBalancesJournalEntry {
		const returnVal : AccountsAndBalancesJournalEntry = {
			id: toConvert.requestedId,
			ownerId: toConvert.ownerId,
			currencyCode: toConvert.currencyCode,
			amount: toConvert.amount,
			pending: false,
			debitedAccountId: toConvert.debitedAccountId,
			creditedAccountId: toConvert.creditedAccountId,
			timestamp: Date.now()
		};
		return returnVal;
	}
}
