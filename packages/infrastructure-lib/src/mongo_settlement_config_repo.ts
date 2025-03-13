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
*****/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {MongoClient, Collection} from "mongodb";
import {
	ISettlementConfigRepo,
	UnableToGetSettlementConfigError,
	UnableToInitRepoError
} from "@mojaloop/settlements-bc-domain-lib";
import {ISettlementConfig} from "@mojaloop/settlements-bc-public-types-lib";
import {Redis} from "ioredis/built/index";

const DEFAULT_REDIS_CACHE_DURATION_SECS = 60; // 60 secs

export class MongoSettlementConfigRepo implements ISettlementConfigRepo {
	// Properties received through the constructor.
	private readonly _logger: ILogger;
	private readonly _dbUrl: string;
	private readonly _dbName: string;
	private readonly _collectionName: string;
	// Other properties.
	private readonly _mongoClient: MongoClient;
	private _configsCollection: Collection;
	private _redisClient: Redis;
	private readonly _keyPrefixId= "settlementConfig_id_";
	private readonly _keyPrefixName= "settlementConfig_name_";
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
				this._configsCollection = db.collection(this._collectionName);
			} else {
				this._configsCollection = await db.createCollection(this._collectionName);
				await this._configsCollection.createIndex({"id": 1}, {unique: true});
			}
			this._logger.info("MongoSettlementConfigRepo - initialised");
		} catch (error: unknown) {
			this._logger.error(error, "MongoSettlementConfigRepo - initialisation failed");
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

	private _parseCachedStr(cachedStr:string): ISettlementConfig | null{
		try{
			const obj = JSON.parse(cachedStr);
		
			// manual conversion for any non-primitive props or children
			return obj;
		}catch (e) {
			this._logger.error(e);
			return null;
		}	
	}
	
	private async _getFromCacheById(id:string):Promise<ISettlementConfig | null>{
		const objStr = await this._redisClient.get(this._getKeyWithIdPrefix(id));
		if(!objStr) return null;

		return this._parseCachedStr(objStr);
	}
	
	private async _getFromCacheByName(name:string):Promise<ISettlementConfig | null>{
		const objStr = await this._redisClient.get(this._getKeyWithNamePrefix(name));
		if(!objStr) return null;

		return this._parseCachedStr(objStr);
	}

	private async _setToCache(config: ISettlementConfig):Promise<void>{
		const parsed:any = {...config};
		
		// optimise: this can be done in a single call with the "multiple"
		await this._redisClient.setex(this._getKeyWithIdPrefix(config.id), this._redisCacheDurationSecs, JSON.stringify(parsed));
		await this._redisClient.setex(this._getKeyWithNamePrefix(config.settlementModel), this._redisCacheDurationSecs, JSON.stringify(parsed));
	}
	
	async storeConfig(config: ISettlementConfig): Promise<void>{
		await this._configsCollection.insertOne(config);
		await this._setToCache(config);
	}

	async getAllSettlementConfigs(): Promise<ISettlementConfig[]>{
		try {
			const configs = await this._configsCollection.find({}, {projection: {_id: 0}}).toArray();
			return configs as unknown as ISettlementConfig[];
			// only called from the API route, not worth optimising with cache
		} catch (error: unknown) {
			throw new UnableToGetSettlementConfigError((error as any)?.message);
		}
	}

	async getSettlementConfig(id: string): Promise<ISettlementConfig | null>{
		try {
			const cachedconfig = await this._getFromCacheById(id);
			if (cachedconfig) return cachedconfig;

			const mongoConfig = await this._configsCollection.findOne({id: id}, {projection: {_id: 0}});
			if (!mongoConfig) return null;

			const config: ISettlementConfig = mongoConfig as unknown as ISettlementConfig;
			await this._setToCache(config);
			return config;
		} catch (error: unknown) {
			throw new UnableToGetSettlementConfigError((error as any)?.message);
		}
	}

	async getSettlementConfigByModelName(modelName: string): Promise<ISettlementConfig | null> {
		try {
			const cachedconfig = await this._getFromCacheByName(modelName);
			if (cachedconfig) return cachedconfig;
			
			const mongoConfig = await this._configsCollection.findOne({settlementModel: modelName}, {projection: {_id: 0}});
			if (!mongoConfig) return null;

			const config: ISettlementConfig = mongoConfig as unknown as ISettlementConfig;
			await this._setToCache(config);
			return config;
		} catch (error: unknown) {
			throw new UnableToGetSettlementConfigError((error as any)?.message);
		}
	}
}
