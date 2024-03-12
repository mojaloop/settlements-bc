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

import {IAccountsBalancesAdapter} from "@mojaloop/settlements-bc-domain-lib";
import {
	AccountsAndBalancesAccount,
	AccountsAndBalancesAccountType,
	AccountsAndBalancesJournalEntry
} from "@mojaloop/accounts-and-balances-bc-public-types-lib";

export class AccountsBalancesAdapterVoid implements IAccountsBalancesAdapter {

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
		return Promise.resolve(requestedId);
	}
	async getAccount(accountId: string): Promise<AccountsAndBalancesAccount | null> {
		return Promise.resolve(null);
	}

	async getAccounts(accountIds: string[]): Promise<AccountsAndBalancesAccount[]> {
		return Promise.resolve([]);
	}

	async getParticipantAccounts(participantId: string): Promise<AccountsAndBalancesAccount[]> {
		return Promise.resolve([]);
	}

	async getJournalEntriesByAccountId(accountId: string): Promise<AccountsAndBalancesJournalEntry[]> {
		return Promise.resolve([]);
	}

	async createJournalEntries(
		entries: AccountsAndBalancesJournalEntry[]
	): Promise<{id: string, errorCode: number}[]> {
		const returnVal: {id: string, errorCode: number}[] = [];
		return Promise.resolve(returnVal);
	}
}
