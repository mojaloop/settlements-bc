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

* Crosslake
- Pedro Sousa Barreto <pedrob@crosslaketech.com>
*****/

"use strict";

import {GrpcCreateJournalEntry, GrpcCreateJournalEntryArray, GrpcIdArray} from "@mojaloop/accounts-and-balances-bc-grpc-client-lib";
import {AccountsAndBalancesAccountType} from "@mojaloop/accounts-and-balances-bc-public-types-lib";
import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {IAccountsBalancesAdapter} from "@mojaloop/settlements-bc-domain-lib";

import {
        AccountsAndBalancesAccount,
} from "@mojaloop/accounts-and-balances-bc-public-types-lib";

import {
    AccountsAndBalancesGrpcClient,
    GrpcCreateAccountArray
} from "@mojaloop/accounts-and-balances-bc-grpc-client-lib";
import {ILoginHelper, UnauthorizedError } from "@mojaloop/security-bc-public-types-lib";
import {AccountsAndBalancesJournalEntry} from "@mojaloop/accounts-and-balances-bc-public-types-lib";

export class GrpcAccountsAndBalancesAdapter implements IAccountsBalancesAdapter {
    private readonly _grpcUrl: string;
    private _logger: ILogger;
    private _client: AccountsAndBalancesGrpcClient;
    private _loginHelper: ILoginHelper;

    constructor(grpcUrl: string, loginHelper: ILoginHelper, logger: ILogger) {
        this._grpcUrl = grpcUrl;
        this._logger = logger.createChild(this.constructor.name);
        this._loginHelper = loginHelper;
    }

    async init(): Promise<void> {
        this._client = new AccountsAndBalancesGrpcClient(
            this._grpcUrl,
            this._loginHelper,
            this._logger
        );
        await this._client.init();
        this._logger.info("GrpcAccountsAndBalancesAdapter initialised successfully");
    }

     setToken(accessToken: string): void {
        //TODO @jason, put this back:
        this._loginHelper.setToken(accessToken);
    }

    setUserCredentials(client_id: string, username: string, password: string): void {
        //TODO @jason, put this back:
        this._loginHelper.setUserCredentials(client_id, username, password);
    }

    setAppCredentials(client_id: string, client_secret: string): void {
        //TODO @jason, put this back:
        this._loginHelper.setAppCredentials(client_id, client_secret);
    }

    async createAccount(requestedId: string, ownerId: string, type: AccountsAndBalancesAccountType, currencyCode: string): Promise<string> {
        const req: GrpcCreateAccountArray = {
            accountsToCreate: [{
                requestedId: requestedId,
                type: type as string,
                ownerId: ownerId,
                currencyCode: currencyCode
            }]
        };

        const createdIds = await this._client.createAccounts(req).catch((reason) => {
            this._logger.error(reason);
            if (reason instanceof Error && reason.constructor.name === "UnauthorizedError"){
                throw new UnauthorizedError(reason.message);
            }

            throw new Error("Could not create account in remote system: "+reason);
        });

        return createdIds.grpcIdArray![0].grpcId!;
    }

    async createJournalEntries(
        entries: AccountsAndBalancesJournalEntry[]
    ): Promise<{id: string, errorCode: number}[]> {
        const mappedEntries:GrpcCreateJournalEntry[] = entries.map(entry=>{
            return {
                requestedId: entry.id || undefined,
                ownerId: entry.ownerId || undefined,
                amount: entry.amount,
                pending: entry.pending,
                currencyCode: entry.currencyCode,
                debitedAccountId: entry.debitedAccountId,
                creditedAccountId: entry.creditedAccountId
            };
        });
        
        const request: GrpcCreateJournalEntryArray = {
            entriesToCreate: mappedEntries
        };

        let response:GrpcIdArray;
        try{
            response = await this._client.createJournalEntries(request);
        }catch(err:any){
            this._logger.error(err);
            throw new Error("Could not create journalEntry in remote system: "+(err.message || err));
        }

        if(!response || !response.grpcIdArray || response.grpcIdArray.length <=0){
            throw new Error("Invalid response from createJournalEntries in remote system");
        }
        if(response.grpcIdArray.length !== entries.length){
            throw new Error("Invalid response from createJournalEntries in remote system - mismatch between request count and response count");
        }
        
        const mappedResponses: {id: string, errorCode: number}[] = response.grpcIdArray.map(resp =>{
            if(resp.grpcId === undefined) throw new Error("invalid id returned from createJournalEntries");
            
            return{
                id: resp.grpcId,
                errorCode: 0 // this will never be an error - will change later 
            };
        });
        
        return mappedResponses;
    }

    async getAccount(accId: string): Promise<AccountsAndBalancesAccount | null> {
        const foundAccounts = await this._client.getAccountsByIds([accId]);
        if(!foundAccounts || foundAccounts.length<=0){
            return null;
        }
        return foundAccounts[0];
    }

    async getAccounts(accountIds: string[]): Promise<AccountsAndBalancesAccount[]>{
        const foundAccounts: AccountsAndBalancesAccount[] = await this._client.getAccountsByIds(accountIds);
        if (!foundAccounts || foundAccounts.length <= 0) {
            return [];
        }

        return foundAccounts;
    }

    async getParticipantAccounts(externalId: string): Promise<AccountsAndBalancesAccount[]> {
        const foundAccounts: AccountsAndBalancesAccount[] = await this._client.getAccountsByOwnerId(externalId);
        if(!foundAccounts || foundAccounts.length <= 0){
            return [];
        }

        return foundAccounts;
    }

    async destroy (): Promise<void> {
        await this._client.destroy();
    }
}
