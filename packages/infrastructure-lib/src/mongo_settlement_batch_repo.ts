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

 * Crosslake
 *  - Pedro Sousa Barreto <pedrob@crosslaketech.com>

 --------------
 ******/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {MongoClient, Collection, Filter} from "mongodb";
import {
	ISettlementBatchRepo,
	UnableToInitRepoError
} from "@mojaloop/settlements-bc-domain-lib";
import {ISettlementBatch} from "@mojaloop/settlements-bc-public-types-lib";


export class MongoSettlementBatchRepo implements ISettlementBatchRepo {
	private readonly _logger: ILogger;
	private readonly _dbUrl: string;
	private readonly _dbName: string;
	private readonly _collectionName: string;
	private readonly mongoClient: MongoClient;
	private _collection: Collection;

	constructor(
		logger: ILogger,
		dbUrl: string,
		dbName: string,
		collectionName: string
	) {
		this._logger = logger;
		this._dbUrl = dbUrl;
		this._dbName = dbName;
		this._collectionName = collectionName;

		this.mongoClient = new MongoClient(this._dbUrl, {
			connectTimeoutMS: 5_000,
			socketTimeoutMS: 5_000
		});
	}

	async init(): Promise<void> {
		try {
			await this.mongoClient.connect(); // Throws if the repo is unreachable.

			const db = this.mongoClient.db(this._dbName);
			const collections = await db.listCollections().toArray();

			// Check if the Participants collection already exists or create.
			if (collections.find(col => col.name === this._collectionName)) {
				this._collection = db.collection(this._collectionName);
			} else {
				this._collection = await db.createCollection(this._collectionName);
				await this._collection.createIndex({"id": 1}, {unique: true});
			}
			this._logger.info("MongoSettlementBatchRepo - initialised");
		} catch (error: unknown) {
			this._logger.error(error, "MongoSettlementBatchRepo - initialisation failed");
			throw new UnableToInitRepoError((error as any)?.message);
		}

	}

	async destroy(): Promise<void> {
		await this.mongoClient.close(); // Doesn't throw if the repo is unreachable.
	}

	async storeNewBatch(batch: ISettlementBatch): Promise<void>{
		await this._collection.insertOne(batch);
	}

	async updateBatch(batch: ISettlementBatch): Promise<void>{
		await this._collection.updateOne({id: batch.id}, {$set: batch});
	}

	//get by full identifier = batch name + batch sequence number
	async getBatch(id: string): Promise<ISettlementBatch | null>{
		try {
			const batch = await this._collection.findOne({id: id}, {projection: {_id: 0}});
			return batch as (ISettlementBatch | null);
		} catch (error: any) {
			throw new Error("Unable to get batch from repo - msg: "+error.message);
		}
	}

	// there can be only one open with the same name (excludes sequence number)
	async getOpenBatchByName(batchName: string): Promise<ISettlementBatch | null>{
		try {
			const batch = await this._collection.findOne({batchName: batchName, isClosed: false}, {sort:["timestamp", "desc"], projection: {_id: 0}});
			return batch as (ISettlementBatch | null);
		} catch (error: any) {
			throw new Error("Unable to get batch from repo - msg: " + error.message);
		}
	}

	// there can be multiple batches with the same name (excludes sequence number)
	async getBatchesByName(batchName: string): Promise<ISettlementBatch[]>{
		try {
			const batches = await this._collection.find({batchName: batchName}).project({_id: 0}).toArray();
			return batches as ISettlementBatch[];
		} catch (error: any) {
			throw new Error("Unable to get batches by name from repo - msg: " + error.message);
		}
	}

	async getBatchesByIds(batchIds: string[]): Promise<ISettlementBatch[]>{
		try {
			const batches = await this._collection.find({id: {$in: batchIds}}).project({_id: 0}).toArray();
			return batches as ISettlementBatch[];
		} catch (error: any) {
			throw new Error("Unable to get batches by ids from repo - msg: " + error.message);
		}
	}

	async getBatchesByCriteria(fromDate: number, toDate: number, currencyCodes: string[], model: string | null): Promise<ISettlementBatch[]>{
		try {
			const paramsForQuery : Filter<any> = [
				{timestamp: {$gte:fromDate}},
				{timestamp: {$lte: toDate}}
			]

			if (model && model.length > 0) paramsForQuery.push({settlementModel: model});
			if (currencyCodes.length > 0) paramsForQuery.push({currencyCode: {$in: currencyCodes}});

			const batches = await this._collection.find({
				$and: [paramsForQuery]
			}).project({_id: 0}).toArray();
			return batches as ISettlementBatch[];
		} catch (error: any) {
			throw new Error("Unable to get batches by criteria from repo - msg: " + error.message);
		}
	}

}
