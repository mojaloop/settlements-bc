import request from "supertest";

import { AccountsBalancesAdapterMock, AuditClientMock, AuthenticationServiceMock, AuthorizationClientMock, MessageCache, MessageProducerMock, ParticipantAccountNotifierMock, SettlementBatchRepoMock, SettlementBatchTransferRepoMock, SettlementConfigRepoMock, SettlementMatrixRequestRepoMock, TokenHelperMock } from "@mojaloop/settlements-bc-shared-mocks-lib";
import { IMessageProducer } from "@mojaloop/platform-shared-lib-messaging-types-lib";
import { ITokenHelper } from "@mojaloop/security-bc-public-types-lib";
import { ConsoleLogger, ILogger } from "@mojaloop/logging-bc-public-types-lib";
import {
    AddBatchesToMatrixCmdPayload,
    IAccountsBalancesAdapter,
    IParticipantAccountNotifier,
    ISettlementBatchRepo,
    ISettlementConfigRepo,
    ISettlementMatrixRequestRepo,
    SettlementsAggregate
} from "@mojaloop/settlements-bc-domain-lib";
import { IAuthorizationClient, CallSecurityContext } from "@mojaloop/security-bc-public-types-lib";
import { IAuditClient } from "@mojaloop/auditing-bc-public-types-lib";
import { Service } from "../../src/service";
import {
    ISettlementBatch,
    ISettlementBatchTransfer,
    ISettlementMatrix,
    ISettlementMatrixBatch,
    ISettlementMatrixBatchAccount,
    ISettlementMatrixParticipantBalance
} from "@mojaloop/settlements-bc-public-types-lib";
import { randomUUID } from "crypto";


const logger: ILogger = new ConsoleLogger();
const msgCache: MessageCache = new MessageCache();
const tokenHelper: ITokenHelper = new TokenHelperMock();

const mockBatchRepo: ISettlementBatchRepo = new SettlementBatchRepoMock();
const mockBatchTransferRepo = new SettlementBatchTransferRepoMock();
const mockMatrixRequestRepo: ISettlementMatrixRequestRepo = new SettlementMatrixRequestRepoMock();

const mockMessageProducer: IMessageProducer = new MessageProducerMock(logger, msgCache);

const mockAuthorizationClient: IAuthorizationClient = new AuthorizationClientMock(logger, true);
const mockAuthorizationClientNoAuth: IAuthorizationClient = new AuthorizationClientMock(logger, false);
const mockAuditClient: IAuditClient = new AuditClientMock(logger);
const mockAccountsAndBalancesAdapter: IAccountsBalancesAdapter = new AccountsBalancesAdapterMock();
const mockConfigRepo: ISettlementConfigRepo = new SettlementConfigRepoMock();
const mockParticipantAccountNotifier: IParticipantAccountNotifier = new ParticipantAccountNotifierMock();

const server = (process.env["SETTLEMENT_SVC_URL"] || "http://localhost:3600");
const AUTH_TOKEN = "bearer: FAKETOKEN";

let mockedSettlementBatch: ISettlementBatch;
let mockedSettlementBatchTransfers: ISettlementBatchTransfer[];
let mockedSettlementMatrix: ISettlementMatrix;
let mockedSettlementMatrixBatches: ISettlementMatrixBatch[];
let mockedSettlementMatrixBatchAccount: ISettlementMatrixBatchAccount[];
let mockedSettlementMatrixParticipantBalances: ISettlementMatrixParticipantBalance[];

describe("Settlement BC api-svc route test", () => {
    beforeAll(async () => {


        await Service.start(
            logger,
            tokenHelper,
            mockAuthorizationClientNoAuth,
            mockAuditClient,
            mockAccountsAndBalancesAdapter,
            mockConfigRepo,
            mockBatchRepo,
            mockBatchTransferRepo,
            mockParticipantAccountNotifier,
            mockMatrixRequestRepo,
            mockMessageProducer
        );

        //Prepare mocked batch data
        mockedSettlementBatch =
        {
            id: "DEFAULT.USD.2023.06.19.08.30.001",
            timestamp: Date.now(),
            settlementModel: 'DEFAULT',
            currencyCode: 'USD',
            batchName: "DEFAULT.USD.2023.06.19.08.30",
            batchSequence: 2, //100 EURO
            state: "OPEN",
            accounts: []
        };

        //Prepare mocked batchTransfer data
        mockedSettlementBatchTransfers = [
            {
                transferId: "T001",
                transferTimestamp: Date.now(),
                payerFspId: "FSP-A",
                payeeFspId: "FSP-B",
                currencyCode: "USD",
                amount: "10",
                batchId: "DEFAULT.USD.2023.06.19.08.30.001",
                batchName: "DEFAULT.USD.2023.06.19.08.30",
                journalEntryId: "string",
                matrixId: "SM001"
            },
            {
                transferId: "T002",
                transferTimestamp: Date.now(),
                payerFspId: "FSP-A",
                payeeFspId: "FSP-B",
                currencyCode: "USD",
                amount: "5",
                batchId: "DEFAULT.USD.2023.06.19.08.30.001",
                batchName: "DEFAULT.USD.2023.06.19.08.30",
                journalEntryId: "string",
                matrixId: "SM001"
            }
        ];

        await mockBatchTransferRepo.storeBatchTransfer(mockedSettlementBatchTransfers[0]);
        await mockBatchTransferRepo.storeBatchTransfer(mockedSettlementBatchTransfers[1]);

        //Prepare mocked Settlement Matrix Account
        mockedSettlementMatrixBatchAccount = [
            {
                id: "SMBA001",
                participantId: "FSP-A",
                accountExtId: "string",
                debitBalance: "10",
                creditBalance: "0"
            },
            {
                id: "SMBA002",
                participantId: "FSP-B",
                accountExtId: "string",
                debitBalance: "0",
                creditBalance: "10"
            }
        ];

        //Prepare mocked Settlement Matrix Participant Balances
        mockedSettlementMatrixParticipantBalances = [
            {
                participantId: "FSP-A",
                debitBalance: "10",
                creditBalance: "0"
            },
            {
                participantId: "FSP-B",
                debitBalance: "0",
                creditBalance: "10"
            }
        ]

        //Prepare mocked Settlement Matrix batch
        mockedSettlementMatrixBatches = [{
            id: "DEFAULT.USD.2023.06.19.08.30.001",
            name: "DEFAULT.USD.2023.06.19.08.30",
            batchDebitBalance: "10",
            batchCreditBalance: "10",
            state: "OPEN",
            batchAccounts: mockedSettlementMatrixBatchAccount
        }]

        //Prepare mocked Matrix
        mockedSettlementMatrix = {
            id: "SM001",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCode: "USD",
            settlementModel: "DEFAULT",
            batches: mockedSettlementMatrixBatches,
            participantBalances: mockedSettlementMatrixParticipantBalances,
            participantBalancesDisputed: [],
            state: "SETTLED",
            type: "STATIC",
            generationDurationSecs: 2,
            totalDebitBalance: "10",
            totalCreditBalance: "10",
            totalDebitBalanceDisputed: "0",
            totalCreditBalanceDisputed: "0"
        }


    })

    afterAll(async () => {
        await Service.stop();
    });

    /**Happy-path Test Cases */

    test("GET /batches/:id - should fetch settlement batch by id", async () => {

        //Arrange
        let mockBatches: ISettlementBatch[] = [
            {
                id: "DEFAULT.USD.2023.06.19.08.30.001",
                timestamp: Date.now(),
                settlementModel: 'DEFAULT',
                currencyCode: 'USD',
                batchName: "DEFAULT.USD.2023.06.19.08.30",
                batchSequence: 2, //100 EURO
                state: "OPEN",
                accounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.20.01.20.001",
                timestamp: Date.now(),
                settlementModel: 'CBX',
                currencyCode: 'USD',
                batchName: "DEFAULT.USD.2023.06.20.01.20",
                batchSequence: 1, //100 EURO
                state: "CLOSED",
                accounts: []
            }
        ];


        await mockBatchRepo.storeNewBatch(mockBatches[0]);
        await mockBatchRepo.storeNewBatch(mockBatches[1]);


        //Act
        const response = await request(server)
            .get(`/batches/${mockBatches[0].id}`)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockBatches[0]);

    });


    test("GET /batches/:id - should send a 500 error response", async () => {

        //Act - request with non-existing batchId
        let response = await request(server)
            .get(`/batches`)
            .query({id:123})
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(404);
    });

    test("GET /batches - should fetch settlement batch by batchName", async () => {

        //Arrange

        let mockBatches: ISettlementBatch[] = [
            {
                id: "DEFAULT.USD.2023.06.19.08.30.001",
                timestamp: Date.now(),
                settlementModel: 'DEFAULT',
                currencyCode: 'USD',
                batchName: "DEFAULT.USD.2023.06.19.08.30",
                batchSequence: 2, //100 EURO
                state: "OPEN",
                accounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.20.01.20.001",
                timestamp: Date.now(),
                settlementModel: 'CBX',
                currencyCode: 'USD',
                batchName: "DEFAULT.USD.2023.06.20.01.20",
                batchSequence: 1, //100 EURO
                state: "CLOSED",
                accounts: []
            }
        ];


        await mockBatchRepo.storeNewBatch(mockBatches[0]);
        await mockBatchRepo.storeNewBatch(mockBatches[1]);


        //Act
        const response = await request(server)
            .get(`/batches`)
            .query({
                batchName: "DEFAULT.USD.2023.06.20.01.20"
            })
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(1);


    });

    test("GET /transfers - should fetch batchTransfers by batchId", async () => {

        //Arrange

        //Act
        const response = await request(server)
            .get(`/transfers`)
            .query({
                batchId: `${mockedSettlementBatch.id}`
            })
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBe(2);

    });

    test("GET /transfers - should fetch batchTransfers by batchName", async () => {

        //Arrange

        //Act
        const response = await request(server)
            .get(`/transfers`)
            .query({
                batchName: `${mockedSettlementBatch.batchName}`
            })
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);


    });


    test("GET /transfers - should fetch batchTransfer by transactionId", async () => {

        //Arrange

        //Act
        const response = await request(server)
            .get(`/transfers`)
            .query({
                transferId: "T002"
            })
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body[0]).toEqual(mockedSettlementBatchTransfers[1]);


    });

    test("GET /transfers - should fetch batchTransfer by matrixId", async () => {

        //Arrange
        await mockMatrixRequestRepo.storeMatrix(mockedSettlementMatrix);

        //Act
        const response = await request(server)
            .get(`/transfers`)
            .query({
                matrixId: "SM001"
            })
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toEqual(2);
    });


    /**Settlement Matrix Routes' Tests */
    test("POST /matrix - should create matrix if doesn't exist", async () => {

        //Arrange

        //Prepare mocked Settlement Matrix Account
        let settlementMatrixBatchAccount: ISettlementMatrixBatchAccount[] = [
            {
                id: "SMBA001",
                participantId: "FSP-A",
                accountExtId: "string",
                debitBalance: "10",
                creditBalance: "0"
            },
            {
                id: "SMBA002",
                participantId: "FSP-B",
                accountExtId: "string",
                debitBalance: "0",
                creditBalance: "10"
            }
        ];

        //Prepare mocked Settlement Matrix Participant Balances
        let settlementMatrixParticipantBalances: ISettlementMatrixParticipantBalance[] = [
            {
                participantId: "FSP-A",
                debitBalance: "5",
                creditBalance: "0"
            },
            {
                participantId: "FSP-B",
                debitBalance: "0",
                creditBalance: "5"
            }
        ];

        //Prepare mocked Settlement Matrix batch
        let settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [{
            id: "DEFAULT.EUR.2023.06.19.08.30.001",
            name: "DEFAULT.EUR.2023.06.19.08.30",
            batchDebitBalance: "5",
            batchCreditBalance: "5",
            state: "OPEN",
            batchAccounts: settlementMatrixBatchAccount
        }];

        let newMatrixId = randomUUID();

        let newMatrix: ISettlementMatrix = {
            id: newMatrixId,
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCode: "EUR",
            settlementModel: "DEFAULT",
            batches: settlementSettlementMatrixBatches,
            participantBalances: settlementMatrixParticipantBalances,
            participantBalancesDisputed: [],
            state: "SETTLED",
            type: "STATIC",
            generationDurationSecs: 2,
            totalDebitBalance: "5",
            totalCreditBalance: "5",
            totalDebitBalanceDisputed: "0",
            totalCreditBalanceDisputed: "0"
        };

        await mockMatrixRequestRepo.storeMatrix(newMatrix);

        //Act
        const response = await request(server)
            .post(`/matrix`)
            .send(newMatrix)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');

    });

    /**Settlement Matrix Routes' Tests */
    test("POST /matrix/:id/batches - should add batches to the given matrix", async () => {

        //Arrange

        //Prepare mocked Settlement Matrix batches
        let settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.19.08.30.001",
                name: "DEFAULT.EUR.2023.06.19.08.30",
                batchDebitBalance: "5",
                batchCreditBalance: "5",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.23.08.22.001",
                name: "DEFAULT.USD.2023.06.23.08.22",
                batchDebitBalance: "5",
                batchCreditBalance: "5",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        let newMatrixId = randomUUID();

        let newMatrix: ISettlementMatrix = {
            id: newMatrixId,
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCode: "EUR",
            settlementModel: "DEFAULT",
            batches: settlementSettlementMatrixBatches,
            participantBalances: [],
            participantBalancesDisputed: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2,
            totalDebitBalance: "5",
            totalCreditBalance: "5",
            totalDebitBalanceDisputed: "0",
            totalCreditBalanceDisputed: "0"
        };

        let payload: AddBatchesToMatrixCmdPayload = {
            matrixId: newMatrix.id,
            batchIds: [
                settlementSettlementMatrixBatches[0].id,
                settlementSettlementMatrixBatches[1].id
            ]
        }

        //Act
        const response = await request(server)
            .post(`/matrix/${newMatrix.id}/batches`)
            .send(payload)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toEqual(newMatrix.id);

    });

    test("DELETE /matrix/:id/batches should send message RemoveBatchesFromMatrixCmd to kafka queue", async () => {
        //Arrange

        //Prepare mocked Settlement Matrix batches
        let settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.21.08.30.001",
                name: "DEFAULT.EUR.2023.06.21.08.30",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.21.08.22.001",
                name: "DEFAULT.EUR.2023.06.21.08.22",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        let newMatrixId = randomUUID();

        let newMatrix: ISettlementMatrix = {
            id: newMatrixId,
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCode: "EUR",
            settlementModel: "DEFAULT",
            batches: settlementSettlementMatrixBatches,
            participantBalances: [],
            participantBalancesDisputed: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2,
            totalDebitBalance: "15",
            totalCreditBalance: "15",
            totalDebitBalanceDisputed: "0",
            totalCreditBalanceDisputed: "0"
        };

        let payload: AddBatchesToMatrixCmdPayload = {
            matrixId: newMatrix.id,
            batchIds: [
                settlementSettlementMatrixBatches[0].id,
                settlementSettlementMatrixBatches[1].id
            ]
        }

        //Act
        const response = await request(server)
            .delete(`/matrix/${newMatrix.id}/batches`)
            .send(payload)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toEqual(newMatrix.id);
    });

    test("POST /matrix/:id/recalculate should send message RecalculateMatrixCmd to kafka queue", async () => {
        //Arrange

        //Prepare mocked Settlement Matrix batches
        let settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.21.08.30.001",
                name: "DEFAULT.EUR.2023.06.21.08.30",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.21.08.22.001",
                name: "DEFAULT.EUR.2023.06.21.08.22",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        let newMatrix: ISettlementMatrix = {
            id: "TestMatrix",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCode: "EUR",
            settlementModel: "DEFAULT",
            batches: settlementSettlementMatrixBatches,
            participantBalances: [],
            participantBalancesDisputed: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2,
            totalDebitBalance: "15",
            totalCreditBalance: "15",
            totalDebitBalanceDisputed: "0",
            totalCreditBalanceDisputed: "0"
        };

        await mockMatrixRequestRepo.storeMatrix(newMatrix);

        let payload: AddBatchesToMatrixCmdPayload = {
            matrixId: "TestMatrix",
            batchIds: [
                settlementSettlementMatrixBatches[0].id,
                settlementSettlementMatrixBatches[1].id
            ]
        }

        //Act
        const response = await request(server)
            .post(`/matrix/TestMatrix/recalculate`)
            .send(payload)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toEqual("TestMatrix");
    });

    
    test("POST /matrix/:id/close should send message CloseMatrixCmd to kafka queue", async () => {
        //Arrange

        //Prepare mocked Settlement Matrix batches
        let settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.21.08.30.001",
                name: "DEFAULT.EUR.2023.06.21.08.30",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.21.08.22.001",
                name: "DEFAULT.EUR.2023.06.21.08.22",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        let newMatrix: ISettlementMatrix = {
            id: "TestMatrix1",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCode: "EUR",
            settlementModel: "DEFAULT",
            batches: settlementSettlementMatrixBatches,
            participantBalances: [],
            participantBalancesDisputed: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2,
            totalDebitBalance: "15",
            totalCreditBalance: "15",
            totalDebitBalanceDisputed: "0",
            totalCreditBalanceDisputed: "0"
        };

        await mockMatrixRequestRepo.storeMatrix(newMatrix);

        let payload: AddBatchesToMatrixCmdPayload = {
            matrixId: "TestMatrix1",
            batchIds: [
                settlementSettlementMatrixBatches[0].id,
                settlementSettlementMatrixBatches[1].id
            ]
        }

        //Act
        const response = await request(server)
            .post(`/matrix/TestMatrix1/close`)
            .send(payload)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toEqual("TestMatrix1");
    });

    test("POST /matrix/:id/settle should send message SettleMatrixCmd to kafka queue", async () => {
        //Arrange

        //Prepare mocked Settlement Matrix batches
        let settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.21.08.30.001",
                name: "DEFAULT.EUR.2023.06.21.08.30",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.21.08.22.001",
                name: "DEFAULT.EUR.2023.06.21.08.22",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        let newMatrix: ISettlementMatrix = {
            id: "TestMatrix2",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCode: "EUR",
            settlementModel: "DEFAULT",
            batches: settlementSettlementMatrixBatches,
            participantBalances: [],
            participantBalancesDisputed: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2,
            totalDebitBalance: "15",
            totalCreditBalance: "15",
            totalDebitBalanceDisputed: "0",
            totalCreditBalanceDisputed: "0"
        };

        await mockMatrixRequestRepo.storeMatrix(newMatrix);

        let payload: AddBatchesToMatrixCmdPayload = {
            matrixId: "TestMatrix2",
            batchIds: [
                settlementSettlementMatrixBatches[0].id,
                settlementSettlementMatrixBatches[1].id
            ]
        }

        //Act
        const response = await request(server)
            .post(`/matrix/TestMatrix2/settle`)
            .send(payload)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toEqual("TestMatrix2");
    });

    test("POST /matrix/:id/dispute should send message DisputeMatrixCmd to kafka queue", async () => {
        //Arrange

        //Prepare mocked Settlement Matrix batches
        let settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.21.08.30.001",
                name: "DEFAULT.EUR.2023.06.21.08.30",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.21.08.22.001",
                name: "DEFAULT.EUR.2023.06.21.08.22",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        let newMatrix: ISettlementMatrix = {
            id: "TestMatrix3",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCode: "EUR",
            settlementModel: "DEFAULT",
            batches: settlementSettlementMatrixBatches,
            participantBalances: [],
            participantBalancesDisputed: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2,
            totalDebitBalance: "15",
            totalCreditBalance: "15",
            totalDebitBalanceDisputed: "0",
            totalCreditBalanceDisputed: "0"
        };

        await mockMatrixRequestRepo.storeMatrix(newMatrix);

        let payload: AddBatchesToMatrixCmdPayload = {
            matrixId: "TestMatrix3",
            batchIds: [
                settlementSettlementMatrixBatches[0].id,
                settlementSettlementMatrixBatches[1].id
            ]
        }

        //Act
        const response = await request(server)
            .post(`/matrix/TestMatrix3/dispute`)
            .send(payload)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(202);
        expect(response.body).toHaveProperty('id');
        expect(response.body.id).toEqual("TestMatrix3");
    });

    test("GET /matrix/:id should get SettlementMatrix by Id", async () => {
        //Arrange

        //Prepare mocked Settlement Matrix batches
        let settlementSettlementMatrixBatches: ISettlementMatrixBatch[] = [
            {
                id: "DEFAULT.EUR.2023.06.21.08.30.001",
                name: "DEFAULT.EUR.2023.06.21.08.30",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
            {
                id: "DEFAULT.USD.2023.06.21.08.22.001",
                name: "DEFAULT.EUR.2023.06.21.08.22",
                batchDebitBalance: "15",
                batchCreditBalance: "15",
                state: "OPEN",
                batchAccounts: []
            },
        ];

        //Prepare mocked Matrix

        let newMatrix: ISettlementMatrix = {
            id: "TestMatrix4",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCode: "EUR",
            settlementModel: "DEFAULT",
            batches: settlementSettlementMatrixBatches,
            participantBalances: [],
            participantBalancesDisputed: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2,
            totalDebitBalance: "15",
            totalCreditBalance: "15",
            totalDebitBalanceDisputed: "0",
            totalCreditBalanceDisputed: "0"
        };

        await mockMatrixRequestRepo.storeMatrix(newMatrix);

        let payload: AddBatchesToMatrixCmdPayload = {
            matrixId: "TestMatrix4",
            batchIds: [
                settlementSettlementMatrixBatches[0].id,
                settlementSettlementMatrixBatches[1].id
            ]
        }

        //Act
        const response = await request(server)
            .get(`/matrix/TestMatrix4`)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual(newMatrix);
    });

    test("GET /matrix should get list of Matrices", async () => {
        //Arrange
        let matrix1: ISettlementMatrix = {
            id: "matrix1",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCode: "EUR",
            settlementModel: "DEFAULT",
            batches: [],
            participantBalances: [],
            participantBalancesDisputed: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2,
            totalDebitBalance: "15",
            totalCreditBalance: "15",
            totalDebitBalanceDisputed: "0",
            totalCreditBalanceDisputed: "0"
        };

        let matrix2: ISettlementMatrix = {
            id: "matrix2",
            createdAt: new Date().getTime() / 1000,
            updatedAt: 0,
            dateFrom: null,
            dateTo: null,
            currencyCode: "EUR",
            settlementModel: "DEFAULT",
            batches: [],
            participantBalances: [],
            participantBalancesDisputed: [],
            state: "IDLE",
            type: "STATIC",
            generationDurationSecs: 2,
            totalDebitBalance: "15",
            totalCreditBalance: "15",
            totalDebitBalanceDisputed: "0",
            totalCreditBalanceDisputed: "0"
        };

        await mockMatrixRequestRepo.storeMatrix(matrix1);
        await mockMatrixRequestRepo.storeMatrix(matrix2);


        //Act
        const response = await request(server)
            .get(`/matrix`)
            .set('authorization', AUTH_TOKEN);

        //Assert
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);

    });


});
