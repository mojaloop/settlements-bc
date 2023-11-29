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
import {ISettlementMatrix, MatrixSearchResults} from "@mojaloop/settlements-bc-public-types-lib";
import {FindOptions} from "mongodb/mongodb";


const MAX_ENTRIES_PER_PAGE = 100;


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

	/**
	 * Get matrices based on search criteria - if pageSize is not passed pagination is ignored and all matching records returned
	 * @param matrixId
	 * @param type
	 * @param state
	 * @param model
	 * @param currencyCodes
	 * @param createdAt
	 * @param pageIndex
	 * @param pageSize
	 */
	async getMatrices(
		matrixId?: string,
		type?: string,
		state?: string,
		model?: string,
		currencyCodes?: string[],
		startDate?: number,
        endDate?: number,
		pageIndex?: number,
        pageSize?: number
	): Promise<MatrixSearchResults> {
		try {
			const filter = [];
			if (matrixId) filter.push({ id: matrixId });
			if (type) filter.push({ type: type });
			if (state) filter.push({ state: state });
			if (model) filter.push({ settlementModel: model });
			if (currencyCodes && currencyCodes.length > 0) filter.push({ currencyCodes: { $in: currencyCodes } });
			if (startDate) filter.push({ updatedAt: { $gte: startDate } });
			if (endDate) filter.push({ updatedAt: { $lte: endDate } });

			const match = filter.length > 0 ? { $and: filter } : {};
			const options: FindOptions<Document>  ={
				sort:["updatedAt", "desc"]
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

			const searchResults: MatrixSearchResults = {
				pageIndex: pageIndex || 0,
				pageSize: pageSize ?? totalDoc,
				totalPages: pageSize ?  Math.ceil(totalDoc / pageSize) : 1,
				items: resultArr as ISettlementMatrix[]
			};

			return searchResults;

		} catch (error: any) {
			throw new Error("Unable to getMatrices from repo - msg: " + error.message);
		}
	}

	async getIdleMatricesWithBatchId(batchId: string): Promise<ISettlementMatrix[]>{
		try {
			// TODO use the $in operator from MongoDB to offload the matching by child batchId to the DB engin
			const resp = await this._collection.find({state: "IDLE"}).project({_id: 0}).toArray();
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
