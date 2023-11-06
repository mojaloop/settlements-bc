/// <reference lib="dom" />
import process from "process";
import {randomUUID} from "crypto";

import PubMessages, {TransferFulfilCommittedRequestedEvt} from "@mojaloop/platform-shared-lib-public-messages-lib";
import { MLKafkaJsonConsumer, MLKafkaJsonProducer } from "@mojaloop/platform-shared-lib-nodejs-kafka-client-lib";
import {ConsoleLogger} from "@mojaloop/logging-bc-public-types-lib";

const KAFKA_URL = process.env["KAFKA_URL"] || "localhost:9092";

const logger = new ConsoleLogger();
logger.setLogLevel("info");

const kafkaConsumerOptions = {
    kafkaBrokerList: KAFKA_URL,
    kafkaGroupId: `transfs_perftest2_sender`
};
const kafkaProducerOptions = {
    kafkaBrokerList: KAFKA_URL
};


// let messageConsumer = new MLKafkaJsonConsumer(kafkaConsumerOptions, logger.createChild));
// await messageConsumer.connect();
let messageProducer = new MLKafkaJsonProducer(kafkaProducerOptions, logger);
await messageProducer.connect();

const MESSAGE_COUNT = 1440000;
const BATCH_SIZE = 52;
const BATCH_WAIT_MS = 500;

let sent=0;

/* test constants */

const payerId = "greenbank";
const payeeId = "bluebank";
const amount = {"currency": "EUR", "amount": "2"};

async function sendNewPrepareEvt(batchSize){
    const now = Date.now();
    const toSend = [];

    for(let i=0; i<batchSize; i++){
        const msgPayload = {
            transferId: randomUUID(),
            payeeFsp: payeeId,
            payerFsp: payerId,
            amount: amount.amount,
            currencyCode: amount.currency,
            ilpPacket: "",
            condition: "",
            expiration: new Date(now + 5*60*1000).toISOString(),
            extensionList: []
        };

        const evt = new PubMessages.TransferPrepareRequestedEvt(msgPayload);
        evt.fspiopOpaqueState = {
            headers: {
                "fspiop-source": payerId,
                "fspiop-destination": payeeId
            },
            prepareSendTimestamp:now
        }
        evt.msgKey = evt.payload.transferId;
        toSend.push(evt);
        //console.log(`Transfer with id: ${msgPayload.transferId} sent...`);
    }

    await messageProducer.send(toSend);

    const elapsedSecs = (Date.now()-startTime)/1000;
    console.log(`Batch sent - batchsize: ${batchSize} - total sent: ${sent} - elapsedSecs: ${elapsedSecs} avg msg/sec: ${sent/elapsedSecs}`);
}


async function send() {
    await sendNewPrepareEvt(BATCH_SIZE);
    sent = sent + BATCH_SIZE;

    if(MESSAGE_COUNT==0 || sent <= MESSAGE_COUNT){
        setTimeout(send, BATCH_WAIT_MS);
    } else {
        setTimeout(process.exit(), 1000);
    }
}

let startTime = Date.now();

send();


async function _handle_int_and_term_signals(signal) {
    console.info(`Service - ${signal} received - cleaning up...`);
    // await messageConsumer.stop();
    // await messageConsumer.disconnect()
    await messageProducer.disconnect()
    process.exit();
}

//catches ctrl+c event
process.on("SIGINT", _handle_int_and_term_signals);
//catches program termination event
process.on("SIGTERM", _handle_int_and_term_signals);

//do something when app is closing
process.on("exit", async () => {
    console.info("Microservice - exiting...");
});
process.on("uncaughtException", (err) => {
    console.error(err, "UncaughtException - EXITING...");
    process.exit(999);
});
