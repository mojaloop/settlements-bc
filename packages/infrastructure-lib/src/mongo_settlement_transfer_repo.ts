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
	UnableToInitRepoError
} from "@mojaloop/settlements-bc-domain-lib";
import {BatchTransferSearchResults, ISettlementBatchTransfer} from "@mojaloop/settlements-bc-public-types-lib";
import {ISettlementBatchTransferRepo} from "@mojaloop/settlements-bc-domain-lib";


const MAX_ENTRIES_PER_PAGE = 100;


export class MongoSettlementTransferRepo implements ISettlementBatchTransferRepo {
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
				await this._collection.createIndex({"transferId": 1}, {unique: true});
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

	async storeBatchTransfer(batchTransfer: ISettlementBatchTransfer): Promise<void>{
		await this._collection.updateOne({transferId: batchTransfer.transferId}, {$set: batchTransfer}, {upsert: true});
	}

	async getBatchTransfersByTransferId(transferId: string): Promise<ISettlementBatchTransfer[]> {
		try {
			const batches = await this._collection.find({transferId: transferId}).project({_id: 0}).toArray();
			return batches as ISettlementBatchTransfer[];
		} catch (error: any) {
			throw new Error("Unable to get transfers by transferId from repo - msg: " + error.message);
		}
	}

	async getBatchTransfersByBatchIds(batchIds: string[]): Promise<ISettlementBatchTransfer[]> {
		try {
			const batches = await this._collection.find({batchId: {$in: batchIds}}).project({_id: 0}).toArray();
			return batches as ISettlementBatchTransfer[];
		} catch (error: any) {
			throw new Error("Unable to get transfers by batchIds from repo - msg: " + error.message);
		}
	}

	async getBatchTransfersByBatchIdsWithPagi(
		batchIds: string[],
		pageIndex: number = 0,
        pageSize: number = MAX_ENTRIES_PER_PAGE,
	): Promise<BatchTransferSearchResults> {
		try {
			// Pagination settings
			pageIndex = Math.max(pageIndex, 0);
			pageSize = Math.min(pageSize, MAX_ENTRIES_PER_PAGE);
			const skip = pageIndex * pageSize;

			const pipeline = [
				{
					$facet: {
						items: [{ $skip: skip }, { $limit: pageSize }],
						totalDoc: [{
							$group: { _id: null, count: { $sum: 1 } }
						}]
					}
				}, 
				{
					$unwind: "$totalDoc"
				},
				{
					$project: {
						items: 1,
						totalDoc: "$totalDoc.count"
					}
				}
			];

			const resultArr = await this._collection.aggregate(pipeline).toArray();

			const searchResults: BatchTransferSearchResults = {
				pageIndex: pageIndex,
				pageSize: pageSize,
				totalPages: 0,
				items: []
			}

			if (resultArr && resultArr.length > 0) {
				const result = resultArr[0] as any;
				searchResults.items = result.items;
				searchResults.totalPages = Math.ceil(result.totalDoc / pageSize);
			}

			return searchResults;

		} catch (error: any) {
			throw new Error("Unable to get transfers by batchIds from repo - msg: " + error.message);
		}
	}

	async getBatchTransfersByBatchNames(batchNames: string[]): Promise<ISettlementBatchTransfer[]> {
		try {
			const batches = await this._collection.find({batchName: {$in: batchNames}}).project({_id: 0}).toArray();
			return batches as ISettlementBatchTransfer[];
		} catch (error: any) {
			throw new Error("Unable to get transfers by batchNames from repo - msg: " + error.message);
		}
	}
	async getBatchTransfers(): Promise<ISettlementBatchTransfer[]> {
		try {
			const batches = await this._collection.find({}).project({_id: 0}).toArray();
			return batches as ISettlementBatchTransfer[];
		} catch (error: any) {
			throw new Error("Unable to get transfers from repo - msg: " + error.message);
		}
	}
}
