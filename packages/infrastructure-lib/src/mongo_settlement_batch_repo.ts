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
import {MongoClient, Collection, Filter, FindOptions, Batch} from "mongodb";
import {
	ISettlementBatchRepo,
	UnableToInitRepoError
} from "@mojaloop/settlements-bc-domain-lib";
import {
	ISettlementBatch,
	BatchSearchResults,
} from "@mojaloop/settlements-bc-public-types-lib";
import {Redis} from "ioredis";

const MAX_ENTRIES_PER_PAGE = 100;
const DEFAULT_REDIS_CACHE_DURATION_SECS = 5; // 5 secs 

export class MongoSettlementBatchRepo implements ISettlementBatchRepo {
	private readonly _logger: ILogger;
	private readonly _dbUrl: string;
	private readonly _dbName: string;
	private readonly _collectionName: string;
	private readonly _mongoClient: MongoClient;
	private _collection: Collection;
	private _redisClient: Redis;
	private readonly _keyPrefixId= "settlementBatch_id_";
	private readonly _keyPrefixName= "settlementBatch_name_";
	private readonly _redisCacheDurationSecs:number;

	constructor(
		logger: ILogger,
		dbUrl: string,
		dbName: string,
		collectionName: string,
		redisHost: string,
		redisPort: number,
		redisCacheDurationSecs = DEFAULT_REDIS_CACHE_DURATION_SECS
	) {
		this._logger = logger;
		this._dbUrl = dbUrl;
		this._dbName = dbName;
		this._collectionName = collectionName;
		this._redisCacheDurationSecs = redisCacheDurationSecs;

		this._mongoClient = new MongoClient(this._dbUrl, {
			connectTimeoutMS: 5_000,
			socketTimeoutMS: 5_000
		});
		
		this._redisClient = new Redis({
			port: redisPort,
			host: redisHost,
			lazyConnect: true
		});
	}

	async init(): Promise<void> {
		try {
			await this._mongoClient.connect(); // Throws if the repo is unreachable.

			const db = this._mongoClient.db(this._dbName);
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

		try{
			await this._redisClient.connect();
			this._logger.debug("Connected to Redis successfully");
		}catch(error: unknown){
			this._logger.error(`Unable to connect to redis cache: ${(error as Error).message}`);
			throw error;
		}
	}
	
	async destroy(): Promise<void> {
		await this._mongoClient.close(); // Doesn't throw if the repo is unreachable.
		this._redisClient.disconnect();
	}

	private _getKeyWithIdPrefix (id: string): string {
		return this._keyPrefixId + id;
	}
	
	private _getKeyWithNamePrefix (name: string): string {
		return this._keyPrefixName + name;
	}

	private _parseCachedStr(cachedStr:string): ISettlementBatch | null{
		try{
			const obj = JSON.parse(cachedStr);

			// manual conversion for any non-primitive props or children
			return obj;
		}catch (e) {
			this._logger.error(e);
			return null;
		}
	}

	private async _getFromCacheById(id:string):Promise<ISettlementBatch | null>{
		const objStr = await this._redisClient.get(this._getKeyWithIdPrefix(id));
		if(!objStr) return null;

		return this._parseCachedStr(objStr);
	}

	private async _getFromCacheByName(name:string):Promise<ISettlementBatch | null>{
		const objStr = await this._redisClient.get(this._getKeyWithNamePrefix(name));
		if(!objStr) return null;

		return this._parseCachedStr(objStr);
	}
	
	private async _setToCache(batch:ISettlementBatch):Promise<void>{
		const parsed:any = {...batch};

		// optimise: this can be done in a single call with the "multiple"
		await this._redisClient.setex(this._getKeyWithIdPrefix(batch.id), this._redisCacheDurationSecs, JSON.stringify(parsed));
		await this._redisClient.setex(this._getKeyWithNamePrefix(batch.batchName), this._redisCacheDurationSecs, JSON.stringify(parsed));
	}

	async storeNewBatch(batch: ISettlementBatch): Promise<void>{
		await this._collection.insertOne(batch);
		await this._setToCache(batch);	
	}

	async updateBatch(batch: ISettlementBatch): Promise<void>{
		await this._collection.updateOne({id: batch.id}, {$set: batch});
		await this._setToCache(batch);
	}

	//get by full identifier = batch name + batch sequence number
	async getBatch(id: string): Promise<ISettlementBatch | null>{
		try {
			const cachedBatch = await this._getFromCacheById(id);
			if (null != cachedBatch) return cachedBatch;
			
			const mongoBatch = await this._collection.findOne({id: id}, {projection: {_id: 0}});
			if (!mongoBatch) return null;
			
			const batch: ISettlementBatch = mongoBatch as unknown as ISettlementBatch;
			await this._setToCache(batch);
			return batch;
		} catch (error: any) {
			throw new Error("Unable to get batch from repo - msg: "+error.message);
		}
	}

/*	// there can be only one open with the same name (excludes sequence number)
	async getOpenBatchByName(batchName: string): Promise<ISettlementBatch | null>{
		try {
			const mongoBatch = await this._collection.findOne({batchName: batchName, isClosed: false}, {sort:["timestamp", "desc"], projection: {_id: 0}});
			if (!mongoBatch) return null;
			
			const batch: ISettlementBatch = mongoBatch as unknown as ISettlementBatch;
			await this._setToCache(batch);
			return batch;
		} catch (error: any) {
			throw new Error("Unable to get batch from repo - msg: " + error.message);
		}
	}*/

	/**
	 * Return Batches by batch name - if pageSize is not passed pagination is ignored and all matching records returned
	 * there can be multiple batches with the same name (excludes sequence number)
	 * @param batchName
	 * @param pageIndex
	 * @param pageSize
	 */
	async getBatchesByName(
		batchName: string, 
		pageIndex?: number,
        pageSize?: number
	): Promise<BatchSearchResults> {
		try {
			const match = { batchName: batchName };
			const options: FindOptions<Document>  ={
				sort:["timestamp", "desc"]
			};

			// ignore pagination if no pageSize provided - default for internal aggregate calls which need all recs
			if(pageSize){
				pageIndex = Math.max(pageIndex || 0, 0);
				pageSize = Math.min(pageSize, MAX_ENTRIES_PER_PAGE);
				options.skip = pageIndex * pageSize;
				options.limit= pageSize;
			}

			const resultArr = await this._collection.find(
				match,
				options
			).project({_id: 0}).toArray();

			const totalDoc = await this._collection.countDocuments(match);

			const searchResults: BatchSearchResults = {
				pageIndex: pageIndex || 0,
				pageSize: pageSize ?? totalDoc,
				totalPages: pageSize ?  Math.ceil(totalDoc / pageSize) : 1,
				items: resultArr as ISettlementBatch[]
			};

			return searchResults;

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

	/**
	 * gets batches by search criteria (same as dynamic matrices) - if pageSize is not passed pagination is ignored and all matching records returned
	 * @param fromDate
	 * @param toDate
	 * @param model
	 * @param currencyCodes
	 * @param batchStatuses
	 * @param pageIndex
	 * @param pageSize
	 */
	async getBatchesByCriteria(
		fromDate: number,
		toDate: number,
		model: string,
		currencyCodes: string[],
		batchStatuses: string[],
		pageIndex?: number,
		pageSize?: number
	): Promise<BatchSearchResults> {
		try {
			const paramsForQuery :any= [
				{timestamp: {$gte:fromDate}},
				{timestamp: {$lte: toDate}},
				{settlementModel: model}
			];

			if (currencyCodes && currencyCodes.length > 0) paramsForQuery.push({currencyCode: {$in: currencyCodes}});
			if (batchStatuses && batchStatuses.length > 0) paramsForQuery.push({state: {$in: batchStatuses}});

			const match = { $and: paramsForQuery };
			const options: FindOptions<Document>  ={
				sort:["timestamp", "desc"]
			};

			// ignore pagination if no pageSize provided - default for internal aggregate calls which need all recs
			if(pageSize){
				pageIndex = Math.max(pageIndex || 0, 0);
				pageSize = Math.min(pageSize, MAX_ENTRIES_PER_PAGE);
				options.skip = pageIndex * pageSize;
				options.limit= pageSize;
			}

			const resultArr = await this._collection.find(
				match,
				options
			).project({_id: 0}).toArray();

			const totalDoc = await this._collection.countDocuments(match);

			const searchResults: BatchSearchResults = {
				pageIndex: pageIndex || 0,
				pageSize: pageSize ?? totalDoc,
				totalPages: pageSize ?  Math.ceil(totalDoc / pageSize) : 1,
				items: resultArr as ISettlementBatch[]
			};

			return searchResults;

		} catch (error: any) {
			throw new Error("Unable to get batches by criteria from repo - msg: " + error.message);
		}
	}

}
