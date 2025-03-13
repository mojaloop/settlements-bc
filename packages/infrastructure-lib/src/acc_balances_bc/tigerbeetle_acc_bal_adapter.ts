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
- Jason Bruwer <jason.bruwer@coil.com>
*****/

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {
    AccountsAndBalancesAccount,
    AccountsAndBalancesAccountState,
    AccountsAndBalancesAccountType,
    AccountsAndBalancesJournalEntry
} from "@mojaloop/accounts-and-balances-bc-public-types-lib";

import * as TB from "tigerbeetle-node";
import {
    CreateTransfersError,
    CreateAccountsError,
    AccountFilter,
    AccountFilterFlags
} from "tigerbeetle-node";

import net from "net";
import dns from "dns";
import {IAccountsBalancesAdapter} from "@mojaloop/settlements-bc-domain-lib";
import {Currency, IConfigurationClient} from "@mojaloop/platform-configuration-bc-public-types-lib";

const MAX_ENTRIES_PER_BATCH = 8000;

export class TigerBeetleAccountsAndBalancesAdapter implements IAccountsBalancesAdapter {
    private readonly _logger: ILogger;
    private readonly _clusterId: number;
    private readonly _batchingEnabled: boolean;
    private _replicaAddresses: string[];
    private _client: TB.Client;
    private _currencyList: Currency[];
    private _pendingBatch: TB.Transfer[];
    static startupBatchTimer: NodeJS.Timeout;
    static lastSend: number;

    constructor(
        clusterId: number,
        replicaAddresses: string[],
        logger: ILogger,
        configClient: IConfigurationClient,
        batchingEnabled: boolean = true
    ) {
        this._clusterId = clusterId;
        this._replicaAddresses = replicaAddresses;
        this._logger = logger.createChild(this.constructor.name);
        this._currencyList = configClient.globalConfigs.getCurrencies();
        this._batchingEnabled = batchingEnabled;
        if (this._batchingEnabled) {
            this._pendingBatch = [];
            TigerBeetleAccountsAndBalancesAdapter.lastSend = Date.now();
            if (!TigerBeetleAccountsAndBalancesAdapter.startupBatchTimer) {
                TigerBeetleAccountsAndBalancesAdapter.startupBatchTimer = setTimeout(()=>{
                    try {
                        this._sendLocalCachedTimeout();
                    }  catch (error: unknown) {
                        this._logger.error(error);
                        throw error;
                    }
                }, 1_000);
            }
        }
    }

    async init(): Promise<void> {
        this._logger.debug("Init starting..");

        await this._parseAndLookupReplicaAddresses();

        this._logger.info(`TigerBeetleAdapter.init() creating client instance to clusterId: ${this._clusterId} and replica addresses: ${this._replicaAddresses}...`);
        this._client = TB.createClient({
            cluster_id: BigInt(this._clusterId),
            replica_addresses: this._replicaAddresses
        });
    }

    setToken(accessToken: string): void {
        // do nothing.
    }

    setUserCredentials(client_id: string, username: string, password: string): void {
        // do nothing.
    }

    setAppCredentials(client_id: string, client_secret: string): void {
        // do nothing.
    }

    async createAccount(
      requestedId: string,
      ownerId: string,
      type: AccountsAndBalancesAccountType,
      currencyCode: string
    ): Promise<string> {
        // Create request for TigerBeetle:
        const request: TB.Account[] = [{
            id: this._uuidToBigint(requestedId), // u128
            debits_pending: 0n,  // u64
            debits_posted: 0n,  // u64
            credits_pending: 0n, // u64
            credits_posted: 0n, // u64
            user_data_128: this._uuidToBigint(ownerId), // u128, opaque third-party identifier to link this account to an external entity:
            user_data_64: 0n,// u64
            user_data_32: 0,// u32
            reserved: 0, // [48]u8
            ledger: this._obtainLedgerFromCurrency(currencyCode),   // u32, ledger value
            code: this._codeFromDescription(type), // u16, a chart of accounts code describing the type of account (e.g. clearing, settlement)
            flags: 0,  // u16
            timestamp: 0n, // u64, Reserved: This will be set by the server.
        }];

        // Invoke Client:
        try {
            const errors: CreateAccountsError[] = await this._client.createAccounts(request);
            if (errors.length) {
                throw new Error("Cannot create account - error code: "+errors[0].result);
            }
        } catch (error: unknown) {
            this._logger.error(error);
            throw error;
        }
        return requestedId;
    }

    async createJournalEntries(
        entries: AccountsAndBalancesJournalEntry[]
    ): Promise<{id: string, errorCode: number}[]> {
        const returnVal: {id: string, errorCode: number}[] = [];
        const requests: TB.Transfer[] = [];
        for (const entry of entries) {
            requests.push(
                {
                    id: this._uuidToBigint(entry.id!), // u128
                    // Double-entry accounting:
                    debit_account_id: this._uuidToBigint(entry.debitedAccountId),  // u128
                    credit_account_id: this._uuidToBigint(entry.creditedAccountId), // u128
                    amount: BigInt(entry.amount), // u64
                    pending_id: 0n, // u128
                    // Opaque third-party identifier to link this transfer to an external entity:
                    user_data_128: this._uuidToBigint(entry.ownerId!), // u128
                    user_data_64: 0n,
                    user_data_32: 0,
                    // Timeout applicable for a pending/2-phase transfer:
                    timeout: 0, // u64, in nano-seconds.
                    // Collection of accounts usually grouped by the currency:
                    // You can't transfer money between accounts with different ledgers:
                    ledger: this._obtainLedgerFromCurrency(entry.currencyCode),  // u32, ledger for transfer (e.g. currency).
                    // Chart of accounts code describing the reason for the transfer:
                    code: this._codeFromDescription("SETTLEMENT"),  // u16, (e.g. 1-deposit, 2-settlement)
                    flags: 0, // u16
                    timestamp: 0n, //u64, Reserved: This will be set by the server.
                }
            );
        }

        const toStore = await this._processJournalEntriesToStore(requests);
        try {
            if (toStore.length) {
                // Create request for TigerBeetle:
                const errors: CreateTransfersError[] = await this._client.createTransfers(toStore);
                if (errors.length) {
                    for (const err of errors) {
                        const errorReq = toStore[err.index];
                        returnVal.push({id: this._bigIntToUuid(errorReq.id), errorCode: err.result});
                    }
                }
            }
        } catch (error: unknown) {
            this._logger.error(error);
            throw error;
        }
        return Promise.resolve(returnVal);
    }

    private async _processJournalEntriesToStore(
        entries: TB.Transfer[],
        forceFlush: boolean = false
    ): Promise<TB.Transfer[]> {
        if (!this._batchingEnabled) return entries;

        if (forceFlush || (this._pendingBatch.length >= MAX_ENTRIES_PER_BATCH)) {
            const returnVal = this._pendingBatch.splice(0);
            this._logger.debug(`Sending at total of ${returnVal.length} transfers to TB.`);
            this._pendingBatch = [];
            return returnVal;
        }
        entries.forEach(itm => this._pendingBatch.push(itm));

        return [];
    }

    private async _sendLocalCachedTimeout() {
        const toStore = await this._processJournalEntriesToStore([], true);
        try {
            if (toStore.length) {
                // Create request for TigerBeetle:
                const errors: CreateTransfersError[] = await this._client.createTransfers(toStore);
                if (errors.length) {
                    const first = errors[0];
                    throw new Error(`Timer!!! Unable to store transfers: [${first.index}:${first.result}]`);
                }
            }
        } catch (error: unknown) {
            this._logger.error(error);
            throw error;
        } finally {
            TigerBeetleAccountsAndBalancesAdapter.startupBatchTimer = setTimeout(() => {
                try {
                    this._sendLocalCachedTimeout();
                } catch (error: unknown) {
                    this._logger.error(error);
                    throw error;
                }
            }, 1_000);
        }
    }

    async getAccount(accId: string): Promise<AccountsAndBalancesAccount | null> {
        // Create request for TigerBeetle:
        const request = this._uuidToBigint(accId);

        // Invoke Client:
        let accounts: TB.Account[] = [];
        try {
            accounts = await this._client.lookupAccounts([request]);
        } catch (error: unknown) {
            this._logger.error(error);
            throw error;
        }
        return this._mapTbAccountToABAccount(accounts[0]);
    }

    async getAccounts(accountIds: string[]): Promise<AccountsAndBalancesAccount[]>{
        // Create request for TigerBeetle:
        const request = accountIds.map(itm => this._uuidToBigint(itm));

        // Invoke Client:
        let accounts: TB.Account[] = [];
        try {
            accounts = await this._client.lookupAccounts(request);
        } catch (error: unknown) {
            this._logger.error(error);
            throw error;
        }

        return accounts.map(item => this._mapTbAccountToABAccount(item));
    }

    async getParticipantAccounts(externalId: string): Promise<AccountsAndBalancesAccount[]> {
        // Create request for TigerBeetle:
        const userDataTB = this._uuidToBigint(externalId);
        // Invoke Client:
        const accounts: TB.Account[] = [];
        try {
            //TODO requires UserData lookup via (user_data)
            //TODO transfers = await this._client.lookupTransfers(request);
        } catch (error: unknown) {
            this._logger.error(error);
            throw error;
        }
        return accounts.map(item => this._mapTbAccountToABAccount(item));
    }

    private _mapTbAccountToABAccount(item: TB.Account): AccountsAndBalancesAccount {
        return {
            id: this._bigIntToUuid(item.id),
            ownerId: this._bigIntToUuid(item.user_data_128),
            state: "ACTIVE" as AccountsAndBalancesAccountState,
            type: this._coaTxtFrom(item.code) as AccountsAndBalancesAccountType,
            currencyCode: this._obtainCurrencyFromLedger(item.ledger),
            postedDebitBalance: `${item.debits_posted}`,
            pendingDebitBalance: `${item.debits_pending}`,
            postedCreditBalance: `${item.credits_posted}`,
            pendingCreditBalance: `${item.credits_pending}`,
            balance: `${item.credits_posted - item.debits_posted}`,
            timestampLastJournalEntry: Number(item.timestamp)
        };
    }

    private _mapTbTransferToABTransfer(item: TB.Transfer): AccountsAndBalancesJournalEntry {
        return {
            id: this._bigIntToUuid(item.id),
            ownerId: this._bigIntToUuid(item.user_data_128),
            currencyCode: this._obtainCurrencyFromLedger(item.ledger),
            amount: `${item.amount}`,
            pending: false,
            debitedAccountId: this._bigIntToUuid(item.debit_account_id),
            creditedAccountId: this._bigIntToUuid(item.credit_account_id),
            timestamp: Number(item.timestamp)
        };
    }

    private _codeFromDescription(desc: string) : number {
        switch (desc) {
            case "CLEARING": return 1;
            case "SETTLEMENT": return 2;
            default: return 1;
        }
    }

    // check if addresses are IPs or names, resolve if names
    private async _parseAndLookupReplicaAddresses():Promise<void>{
        console.table(this._replicaAddresses);

        const replicaIpAddresses:string[] = [];
        for (const addr of this._replicaAddresses) {
            this._logger.debug(`Parsing addr: ${addr}`);
            const parts = addr.split(":");
            if (!parts) {
                const err = new Error(`Cannot parse replicaAddresses in TigerBeetleAdapter.init() - value: "${addr}"`);
                this._logger.error(err.message);
                throw err;
            }
            this._logger.debug(`\t addr parts are: ${parts[0]} and ${parts[1]}`);

            if (net.isIP(parts[0]) === 0) {
                this._logger.debug(`\t addr part[0] is not an IP address, looking it up..`);
                await dns.promises.lookup(parts[0], {family:4}).then((resp) =>{
                    this._logger.debug(`\t lookup result is: ${resp.address}`);
                    replicaIpAddresses.push(`${resp.address}:${parts[1]}`);
                }).catch((error:Error)=>{
                    const err = new Error(`Lookup error while parsing replicaAddresses in TigerBeetleAdapter.init() - cannot resolve: "${addr[0]}" of "${addr}"`);
                    this._logger.error(err.message);
                    throw err;
                });
            } else {
                this._logger.debug(`\t lookup not necessary, adding addr directly`);
                replicaIpAddresses.push(addr);
            }
        }

        this._replicaAddresses = replicaIpAddresses;
        console.table(this._replicaAddresses);
    }

    // inspired from https://stackoverflow.com/a/53751162/5743904
    private _uuidToBigint(uuid: string) : bigint {
        // let hex = uuid.replaceAll("-",""); // replaceAll only works on es2021
        let hex = uuid.replace(/-/g, "");
        if (hex.length % 2) { hex = "0" + hex; }
        const bi = BigInt("0x" + hex);
        return bi;
    }

    private _coaFrom(type: string): number {
        let coa = 0;
        switch (type) {
            case "POSITION": coa = 1; break;
            case "SETTLEMENT": coa = 2; break;
        }
        return coa;
    }

    private _coaTxtFrom(type: number): string {
        let coa = "POSITION";
        switch (type) {
            case 1: coa = "POSITION"; break;
            case 2: coa = "SETTLEMENT"; break;
        }
        return coa;
    }

    private _bigIntToUuid(bi: bigint): string {
        let str = bi.toString(16);
        while (str.length < 32) str = "0"+str;

        if (str.length !== 32) {
            this._logger.warn(`_bigIntToUuid() got string that is not 32 chars long: "${str}"`);
        } else {
            str = str.substring(0, 8)+"-"+str.substring(8, 12)+"-"+str.substring(12, 16)+"-"+str.substring(16, 20)+"-"+str.substring(20);
        }
        return str;
    }

    async destroy(): Promise<void> {
        if (this._client) await this._client.destroy();
    }

    private _obtainLedgerFromCurrency(currencyTxt: string) : number {
        const returnVal = this._currencyList.find(itm => itm.code === currencyTxt);
        if (returnVal) return Number(returnVal.num);
        return 0;
    }

    private _obtainCurrencyFromLedger(ledgerVal: number) : string {
        const returnVal = this._currencyList.find(itm => Number(itm.num) === ledgerVal);
        if (returnVal) return returnVal.code;
        return '';
    }
}
