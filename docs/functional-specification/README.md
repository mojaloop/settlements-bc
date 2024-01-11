# Mojaloop Settlement Service

The next generation Mojaloop Settlement service handles the settlement of cleared transfers in batches, with transfers allocated to batches in a way that is deterministic. 

The goal of this document, in the context of a Mojaloop hub, is to:
- Define the requirements for settlement processing. 
- Identify the components that make up the Settlement service. 
- Detail how the settlement components interact within the service, and how they interact with external services.

1. [Introduction](#1-introduction)
2. [Settlement Components](#2-settlement-components)
3. [Settlement Batch States](#3-settlement-batch-states)
4. [Settlement Events](#4-settlement-events)
5. [Settlement Transfers](#5-settlement-transfers)
6. [Settlement Reports](#6-settlement-reports)
7. [References](#7-settlement-api-endpoints)
8. [References](#8-references)

## 1. Introduction

The Settlement service is designed to interact with one of the following two Mojaloop transaction clearing services:

- The `Central-Ledger` service that records and processes cleared transactions for the current Production version of Mojaloop (i.e. from v15.0.0 onwards), as at February 2023.

- The `Transfers` service that records cleared transactions for the not yet released Mojaloop major version that aims to align with the full implementation of the 2022 published Reference Architecture (informally referred to as `vNext`).

A Mojaloop hub would either run the `Transfers` or `Central-Ledger` service for clearing transactions, but not both.

## 2. Settlement Components

The diagrams in this section show the components that make up the new Settlement service alongside the components that the settlement service interacts with.

In the diagram below, the new Settlement service is deployed in a Mojaloop environment that runs the current (as at 2023) released Production version of the `Central Ledger` service:
![Settlement components with Central Ledger](./diagrams/6-sttl-components-central-ledger-1.svg "Settlement components with Central Ledger")

The diagram below shows how the new Settlement service integrates into an environment that runs the alpha version (not yet released) of the Mojaloop `vNext` implementation of the Mojaloop Reference Architecture:
![Settlement components with Transfers & other services](./diagrams/6-sttl-components-transfers-bc-2.svg "Settlement components with Transfers & other services")

## 3. Settlement Batch States

The new Settlement service handles processing settlement in batches, and a batch may contain one or multiple transactions.

The state of each settlement batch, and the operations that can be performed on the batch get managed by the settlement state machine.

The table below shows the different settlement batch states:

| State                 | Description                                                                                                                                                          |
|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `OPEN`                | Batch is open and may receive settlement transfers.                                                                                                                   |
| `CLOSED`              | Batch is closed and no more transactions will be allocated to the closed batch.                                                                                       |
| `DISPUTED`            | Batch has been disputed. The dispute needs to be resolved before the batch can be settled.                                                                           |
| `AWAITING_SETTLEMENT` | Batch has been marked ready for final settlement approval. A lock relationship is created between the batch and the report that requested settlement. Only the requesting report linked to the batch is allowed to release/finalise the batch. |
| `SETTLED`             | Batch is settled and considered as final.                                                                                                                             |

The diagram below shows all of the possible state transitions for a settlement batch.

<img src="./diagrams/3-batch_status_scene-3.svg" alt="Settlement Batch State Transitions" width="60%" height="60%">
<!--- Note: I didn't know how to apply a percentage scale down of the image without using raw HTML   --->

## 4. Settlement Events

### 4.1 Cleared Transfers

When a clearing service has completed processing a transfer, it publishes the `TransferPreparedEvtPayload` event. The settlement service listens for and consumes this event, initiating processing cleared transfers into the settlement framework.

The table below shows the elements that make up the `TransferPreparedEvtPayload` event:

| Field            | Definition  | Description                                                                                                                              |
|------------------|-------------|------------------------------------------------------------------------------------------------------------------------------------------|
| `transferId`     | `string`    | An external id used by the external services (Central Ledger / Transfers) used to uniquely identify a transfer                        |
| `payeeFsp`       | `string`    | An participantId id used by the external services (Central Ledger / Transfers) used to identify the payer DFSP                        |
| `payerFsp`       | `string`    | An participantId id used by the external services (Central Ledger / Transfers) used to identify the payee DFSP                        |
| `amount`         | `string`    | The transfer amount in minor denomination format (cents/fills) as text (`string)                                                         |
| `currencyCode`   | `string`    | The currency code as described in ISO-4217                                                                                               |
| `ilpPacket`      | `string`    | The ILP packet transmitted _(optional)_*_. See <https://interledger.org/rfcs/0003-interledger-protocol/>                                     |
| `condition`      | `string`    | The cryptographic condition set on the ILP packet by the sender _(optional)_                                                             |
| `expiration`     | `number`    | The timestamp when the transfer fulfill would have expired, which would have resulted in a rollback (no fulfill post the prepare event). |
| `extensionList`  | `extension` | The list of optional name/value pair extensions that may be added as part of the transfer fulfill _(optional)_                           |

### 4.2 Settled Batches

Once the settlement service has finalised that a batch has been settled, it publishes the `SettlementMatrixSettledParticipantEvtPayload` event. Listening services consume this event about transfers that have been settled.

The table below shows the elements that make up the `SettlementMatrixSettledParticipantEvtPayload` event:
<!--- TODO: add a table for the SettlementMatrixSettledParticipantEvtPayload event --->

*TODO* - add table with a structure similar to the table above, in 4.1 

## 5. Settlement Transfers

The settlement process is initiated when the Settlement service receives notification about cleared transfers. The Settlement service creates settlement obligations between the payer and payee DFSPs
by creating and allocating settlement transfers to settlement batches.

### 5.1 Deterministic batch allocation

In the previous design of the Settlement service, only one settlement window would be open at a time, to which all settlement transfers were allocated.  

The design of this new generation of Settlement enables multiple settlement batches (rather than windows) to be open at a time. The allocation of a transfer to a settlement batch is deterministic. The new Settlement service uses a subset of the fields of a transfer, together with configured data, to determine the batch to which a transfer belongs. Thus, by inspecting the fields of a transfer, one can anticipate, with ease and accuracy, the name of the settlement batch to which a transfer can be found.

The settlement batch is determined using:

- The Settlement model, this is one of the fields of a transfer.
- The currency of the transfer.
- The timestamp of the transfer.
- The configured lifespan of a settlement batch (i.e. a figure that indicates the maximum period that any settlement batch can be open).

### 5.2 Initiate Settlement

When the Mojaloop transaction clearing service has cleared a transaction, it publishes an event called `TransferPreparedEvtPayload` which gets consumed by the new Settlement service.

The Settlement service gets triggered by this event, and proceeds to create settlement transfer transactions. Each settlement transfer gets allocated to the correct settlement batch.

#### 5.2.1 Settlement from the Transfers service

The diagram below shows the flow of transactions that have been cleared by the **Transfers** service:
<img src="./diagrams/01-settlement-transfer-bc.svg" alt="Settlement Transfer Transfers" width="70%" height="70%">
<!---  Note: I didn't know how to apply a percentage scaling down of the image without using raw HTML  --->

##### Cleared Transfers

1. When a user initiates a transfer, the clearing Transfers service creates a transfer prepare. This is the discovery and quoting leg of the transaction.
2. The clearing Transfers service determines the settlement model for each transaction, and adds the settlement model as one of the transaction fields.
3. Once the transfer gets fulfilled, the Transfers publishes the `TransferPreparedEvtPayload` event. The event notifies any listening service about transfers that have been cleared.
4. The command/event handler for settlements processes the event notification, and informs the settlement application logic layer that cleared transfers are ready for settlement processing.

##### Settlement Transfers

1. The Settlement service validates each cleared transfer.
2. Each DFSP participant has settlement configuration data that may have previously been retrieved from the Platform Configuration service, and stored in the settlements database. If this is the case, then the settlement logic layer fetches the participant settlement configuration data from the settlements database.
3. If none of the participant configuration data required for settlement has been stored in the settlements database, then the settlement service requests the data from the Platform Configuration service.
4. The retrieved settlement configuration data gets stored in the settlements database.
5. Based on the settlement model, currency, and timestamp of each transfer, and depending on the configured settlement batch lifespan, the application layer determines the settlement batch to which each transfer belongs. If there is no open settlement batch for a transfer, then a new batch gets created.
6. The settlement application layer requests the payer and payee settlement accounts from the Ledger Adapter.
7. The Ledger Adapter requests the accounts required for the settlement transfers from the Accounts & Balances service.
8. The Accounts & Balances service either retrieves or creates the accounts required for settlement.
9. The Accounts & Balances service provides the settlement accounts to the Ledger Adapter.
10. The Ledger Adapter provides the settlement accounts to the Settlements application layer.
11. At this point, the settlement application layer has determined the settlement batch to which the transfer belongs, and it has obtained the accounts for settlement. The settlement application layer sends a request to the Ledger Adapter to create the actual settlement transfers.
12. The Ledger Adapter requests that the Accounts & Balances service create the settlement transfers. The Accounts & Balances service creates the settlement transfers, and informs the Ledger Adapter that the settlement transfers have been created.
13. The Ledger Adapter informs the settlement application layer about the settlement transfers that were created.
14. The settlement application layer prepares a response to confirm that the settlement transfers have been created.
15. The settlement application layer informs the event/command handler about the settlement transfers that have been successfully created.
16. The command/event handler for settlements publishes the `TransferPreparedEvtPayload` event to inform any listening service that the Settlement service has created settlement transfers.

#### 5.2.2 Settlement from the Central Ledger service

The diagram below shows the flow of transactions that have been cleared by the **Central Ledger** service:
<img src="./diagrams/01-settlement-transfer-cl.svg" alt="Settlement Transfer Flow for Central Ledger" width="70%" height="70%">
<!--  Note: I didn't know how to scale down the image by applying a percentage without using raw HTML  -->

##### Publish Cleared Transfers

1. When a user initiates a transfer, the clearing Central Ledger service creates a transfer prepare. This is the discovery and quoting leg of the transaction.
2. The clearing service determines the settlement model for each transaction, and adds this as one of the fields of the transaction.
3. When the transfer gets fulfilled, the Central Ledger service publishes the `TransferPreparedEvtPayload` event to notify any listening service that a transfer has been cleared. The event handler of the Settlement service listens and gets triggered to handle the event.
4. The settlements event handler informs the settlement application layer that cleared transfers are ready for settlement processing.

##### Create Settlement Transfers

1. The Settlement service validates each cleared transfer.
2. Each DFSP participant has settlement configuration data that may have previously been retrieved from the Central Ledger service, and stored in the settlements database. If this is the case, then the settlement application layer fetches the participant settlement configuration data from the settlements database.
3. If none of the participant configuration data required for settlement has been stored in the settlements database, then the settlement service requests the data from the Central Ledger service.
4. The retrieved settlement configuration data gets stored in the settlements database.
5. Based on the settlement model, currency, and timestamp of each transfer, and depending on the configured settlement batch lifespan, the settlement application layer determines the settlement batch to which each transfer belongs.
6. The settlement application layer sends a request to the Ledger Adapter to provide the payer and payee settlement accounts.
7. The Ledger Adapter requests the accounts required for the settlement transfers from the Central Ledger service.
8. The Central Ledger either retrieves or creates the accounts required for settlement.
9. The Central Ledger provides the settlement accounts to the Ledger Adapter.
10. The Ledger Adapter provides the settlement accounts to the Settlements application layer.
11. At this point, the settlement application layer has determined the settlement batch to which the transfer belongs, and it has obtained the accounts for settlement. The settlement application layer sends a request to the Ledger Adapter to create the actual settlement transfers.
12. The Ledger Adapter requests that the Central Ledger service create the settlement transfers.
13. The Central Ledger creates the settlement transfers.
14. The Central Ledger sends a response to the Ledger Adapter that the settlement transfers have been created.
15. The Ledger Adapter informs the settlement application layer about the settlement transfers that were created.
16. The settlement application layer informs the event/command handler about settlement transfers that have been successfully created.
17. The command/event handler publishes the `TransferPreparedEvtPayload` event to inform listening services that the settlement transfers have been created.

## 6. Settlement Reports

Over time, a hub operator may want to view or report on settlement obligations as they accumulate, and as liquidity gets restored between settling parties. Further, an operator may want to perform other operations on settlement batches such as:

- Closing a batch to prevent adding transactions.
- Disputing a batch if one or more transactions require investigation.
- Resolving a previously disputed batch.
- Locking a batch to indicate that it is awaiting settlement.
- Ensuring that only the process that placed a settlement lock on a batch can release the lock by finalising or cancelling settlement.

A hub operator is able to view batches, along with their various settlement states, and the debit and credit balances of the settling parties. This is achieved by filtering for batches by specifying one or more of the following criteria:

- Settlement batch start and end dates.
- Transaction currencies.
- Settlement models.
- Settlement batch statuses.

*TODO* - add sequence diagrams for 
(1) closing sttl batches 
(2) locking batches for sttl 
(3) finalisng sttl 
(4) disputing batches
(5) cancelling disputed batches.

## 7. Settlement API Endpoints
The following REST API endpoints exists for Settlements.

| Ref # | URL                           | Method   | Description                                                                                                                                                                                                                                                                                                                                         | 
|-------|-------------------------------|----------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `01.` | **/transfers**                | `POST`   | Create a settlement transfer via the REST API instead of a Kafka event. This endpoint is only enabled in "barebone" environments.                                                                                                                                                                                                                   |
| `02.` | **/transfers**                | `GET`    | Retrieve all settlement transfers by batch id, batch name, transfer id or matrix id.                                                                                                                                                                                                                                                                |
| `03.` | **/models**                   | `POST`   | Create a new settlement model configuration.                                                                                                                                                                                                                                                                                                        |
| `04.` | **/models**                   | `GET`    | Retrieve the settlement model configuration based on the settlement model name (query parameter).                                                                                                                                                                                                                                                   |
| `05.` | **/models/:id**               | `GET`    | Retrieve the settlement model configuration based on the settlement model id.                                                                                                                                                                                                                                                                       |
| `06.` | **/batches/:id**              | `GET`    | Retrieve settlement batch by UUID. The batches include the settlement accounts and balances.                                                                                                                                                                                                                                                        |
| `07.` | **/batches**                  | `GET`    | Retrieve settlement batches using search criteria from date, to date, settlement model, batch name, currency codes and batch statuses.                                                                                                                                                                                                              |
| `08.` | **/matrices**                 | `POST`   | Create a settlement matrix and return the matrix UUID *(newly generated)*. Batches that match the matrix criteria will be included as part of the settlement matrix. Any newly created batches will not be automatically associated with the settlement matrix. Newly created transfers will still be allocated to batches that are not yet closed. |
| `09.` | **/matrices/:id/batches**     | `POST`   | Add a specific batch (by uuid) or batches to a `STATIC` settlement matrix.                                                                                                                                                                                                                                                                          |
| `10.` | **/matrices/:id/batches**     | `DELETE` | Remove a specific batch (by uuid) or batches from a `STATIC` settlement matrix.                                                                                                                                                                                                                                                                     |
| `11.` | **/matrices/:id/recalculate** | `POST`   | Request a re-calculation for an existing settlement matrix based on UUID. The re-calculation will include any newly created batches that match the settlement matrix criteria (`DYNAMIC` only).                                                                                                                                                     |
| `12.` | **/matrices/:id/close**       | `POST`   | Close settlement batches and settlement matrix. Closed batches cannot be opened again.                                                                                                                                                                                                                                                              |
| `13.` | **/matrices/:id/settle**      | `POST`   | Settle applicable settlement batches and settlement matrix. Generate a settlement matrix as response. Once a settlement batch is settled, the balances for the batches and accounts will not change. No newly created transfers will be allocated to settled batches. Only a locked matrix may be settled.                                          |
| `14.` | **/matrices/:id/dispute**     | `POST`   | Dispute settlement batches and settlement matrix. Once undisputed, the matrix and batches will be in a closed status.                                                                                                                                                                                                                               |
| `15.` | **/matrices/:id/lock**        | `POST`   | Lock a settlement matrix for settlement. A matrix cannot lock a batch that is already locked by another matrix.                                                                                                                                                                                                                                     |
| `16.` | **/matrices/:id/unlock**      | `POST`   | Unlock a settlement matrix marked for settlement. Only the owning matrix may unlock itself.                                                                                                                                                                                                                                                         |
| `17.` | **/matrices/:id**             | `GET`    | Retrieve the settlement matrix by UUID. If the settlement matrix is not in a closed state, the batch and account balances for the open batches may change due to new transfers.                                                                                                                                                                     |
| `18.` | **/matrices**                 | `GET`    | Retrieve settlement matrices using search criteria matrix-id, from date , to date, type, state, model and currency codes.                                                                                                                                                                                                                           |

## 8. References

The following documentation provides insight into Settlements.

| Ref # | Document                                                             | Link                                                                                                                                   |
|-------|----------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| `01.` | **Diagrams**                                                         | `../diagrams/*.puml`                                                                                                                               |
| `02.` | **Slide Deck - June 2023**                                           | `../Settlement Version 2.pptx`                                                                                                         |
| `03.` | **Settlement Operational Implementation**                            | <https://docs.mojaloop.io/business-operations-framework-docs/guide/SettlementBC.html#core-settlement-operations>                         |
| `04.` | **Reference Architecture**                                           | <https://mojaloop.github.io/reference-architecture-doc/boundedContexts/settlements/>                                                     |
| `05.` | **MIRO Board (Reference Architecture)**                              | <https://miro.com/app/board/o9J_lJyA1TA=/>                                                                                               |
| `06.` | **Settlement Functionality in MJL**                                  | <https://docs.google.com/presentation/d/19uy6pO_igmQ9uZRnKyZkXD8a8uyMKQcn/edit#slide=id.p1>                                              |
| `07.` | **DA Work Sessions**                                                 | <https://docs.google.com/document/d/1Nm6B_tSR1mOM0LEzxZ9uQnGwXkruBeYB2slgYK1Kflo/edit#heading=h.6w64vxvw6er4>                            |
| `08.` | **Admin API - Settlement Models**                                    | <https://github.com/mojaloop/mojaloop-specification/blob/master/admin-api/admin-api-specification-v1.0.md#api-resource-settlementmodels> |
| `09.` | **Mojaloop Product Timeline**                                        | <https://miro.com/app/board/uXjVPA3hBgE=/>                                                                                               |
| `10.` | **Settlement Basic Concepts**                                        | <https://docs.mojaloop.io/mojaloop-business-docs/HubOperations/Settlement/settlement-basic-concepts.html>                                |
| `11.` | **Ledgers in the Hub**                                               | <https://docs.mojaloop.io/mojaloop-business-docs/HubOperations/Settlement/ledgers-in-the-hub.html>                                       |
| `12.` | **Mojaloop 2.0 Reference Architecture - Session With MR - Agreed**   | <https://docs.google.com/spreadsheets/d/1ITmAesHjRZICC0EUNV8vUVV8VDnKLjbSKu_dzhEa5Fw/edit#gid=580827044>                                 |
| `13.` | **Change Request: Modifications to Admin API to support Settlement** | <https://github.com/mojaloop/mojaloop-specification/issues/117>                                                                          |
