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
 *  - Jason Bruwer <jason.bruwer@coil.com>

 --------------
 ******/

"use strict";

import {ILogger} from "@mojaloop/logging-bc-public-types-lib";
import {MongoClient, Collection} from "mongodb";
import {
	ISettlementConfigRepo,
	UnableToGetSettlementConfigError,
	UnableToInitRepoError
} from "@mojaloop/settlements-bc-domain-lib";
import {ISettlementConfig} from "@mojaloop/settlements-bc-public-types-lib";


export class MongoSettlementConfigRepo implements ISettlementConfigRepo {
	// Properties received through the constructor.
	private readonly logger: ILogger;
	private readonly DB_URL: string;
	private readonly DB_NAME: string;
	private readonly COLLECTION_NAME: string;
	// Other properties.
	private readonly mongoClient: MongoClient;
	private configsCollection: Collection;

	constructor(
		logger: ILogger,
		dbUrl: string,
		dbName: string,
		collectionName: string
	) {
		this.logger = logger;
		this.DB_URL = dbUrl;
		this.DB_NAME = dbName;
		this.COLLECTION_NAME = collectionName;

		this.mongoClient = new MongoClient(this.DB_URL, {
			connectTimeoutMS: 5_000,
			socketTimeoutMS: 5_000
		});
	}

	async init(): Promise<void> {
		try {
			await this.mongoClient.connect(); // Throws if the repo is unreachable.

			const db = this.mongoClient.db(this.DB_NAME);
			const collections = await db.listCollections().toArray();

			// Check if the Participants collection already exists or create.
			if (collections.find(col => col.name === this.COLLECTION_NAME)) {
				this.configsCollection = db.collection(this.COLLECTION_NAME);
			} else {
				this.configsCollection = await db.createCollection(this.COLLECTION_NAME);
				await this.configsCollection.createIndex({"id": 1}, {unique: true});
			}
			this.logger.info("MongoSettlementConfigRepo - initialised");
		} catch (error: unknown) {
			this.logger.error(error, "MongoSettlementConfigRepo - initialisation failed");
			throw new UnableToInitRepoError((error as any)?.message);
		}

	}

	async destroy(): Promise<void> {
		await this.mongoClient.close(); // Doesn't throw if the repo is unreachable.
	}

	async storeConfig(config: ISettlementConfig): Promise<void>{
		await this.configsCollection.insertOne(config);
	}

	async getSettlementConfigByModel(model: string): Promise<ISettlementConfig | null> {
		try {
			const config = await this.configsCollection.findOne({settlementModel: model}, {projection: {_id: 0}});
			return config as (ISettlementConfig | null);
		} catch (error: unknown) {
			throw new UnableToGetSettlementConfigError((error as any)?.message);
		}
	}
}
