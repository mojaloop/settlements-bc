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
import {MongoClient, Collection} from "mongodb";
import {
	ISettlementMatrixRequestRepo,
	UnableToInitRepoError
} from "@mojaloop/settlements-bc-domain-lib";
import {ISettlementMatrix} from "@mojaloop/settlements-bc-public-types-lib";


export class MongoSettlementMatrixRepo implements ISettlementMatrixRequestRepo {
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
			this._logger.info("MongoSettlementMatrixRepo - initialised");
		} catch (error: unknown) {
			this._logger.error(error, "MongoSettlementMatrixRepo - initialisation failed");
			throw new UnableToInitRepoError((error as any)?.message);
		}

	}

	async destroy(): Promise<void> {
		await this.mongoClient.close(); // Doesn't throw if the repo is unreachable.
	}

	// Throws if account.id is not unique.
	async storeMatrix(req: ISettlementMatrix): Promise<void>{
		await this._collection.updateOne({id: req.id}, {$set: req}, {upsert: true});
	}

	async getMatrixById(id: string): Promise<ISettlementMatrix | null>{
		try {
			const batch = await this._collection.findOne({id: id}, {projection: {_id: 0}});
			return batch as (ISettlementMatrix | null);
		} catch (error: any) {
			throw new Error("Unable to get matrix from repo - msg: " + error.message);
		}
	}

	async getMatrices(state?:string): Promise<ISettlementMatrix[]>{
		try {
			let resp;
			if(state){
				resp = await this._collection.find({state: state}).project({_id: 0}).toArray();
			}else{
				resp = await this._collection.find().project({_id: 0}).toArray();
			}
			return resp as (ISettlementMatrix[]);
		} catch (error: any) {
			throw new Error("Unable to getMatrices from repo - msg: " + error.message);
		}
	}

	async getMatricesInSyncWhereBatch(state: string, batchId: string): Promise<ISettlementMatrix[]>{
		try {
			const resp = await this._collection.find({state: state, isBatchesOutOfSync: false}).project({_id: 0}).toArray();
			const respMatrix = resp as (ISettlementMatrix[]);
			const ret : ISettlementMatrix[] = [];
			for (const matrixIter of respMatrix) {
				for (const batchIter of matrixIter.batches) {
					if (batchIter.id === batchId) {
						ret.push(matrixIter);
						break;
					}
				}
			}
			return ret;
		} catch (error: any) {
			throw new Error("Unable to getMatrices from repo - msg: " + error.message);
		}
	}
}
