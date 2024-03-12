package io.mojaloop.settlement.jmeter.plugin.kafka;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.ProcessTransferCmd;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferReq;
import org.apache.kafka.clients.producer.*;
import org.apache.kafka.common.serialization.StringSerializer;
import org.json.JSONObject;

import java.util.Date;
import java.util.Properties;
import java.util.concurrent.ExecutionException;

public class TxnProducer {
    private Producer<String, String> producer;
    private String topic;

    public void init(String url, String topic) {
        Properties props = new Properties();
        props.put(ProducerConfig.CLIENT_ID_CONFIG, "go-go-client");
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, url);//"localhost:9092"
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());

        this.topic = topic;
        this.producer = new KafkaProducer<>(props);
    }

    private RecordMetadata send(
            String key,
            String value
    ) throws ExecutionException, InterruptedException {
        final ProducerRecord<String, String> record = new ProducerRecord<>(this.topic, key, value);
        RecordMetadata metadata = this.producer.send(record).get();
        return metadata;
    }

    public RecordMetadata send(TransferReq req) throws ExecutionException, InterruptedException {

        ProcessTransferCmd cmd = new ProcessTransferCmd(new JSONObject());
        cmd.setAggregateId(req.getTransferId());
        cmd.setMsgKey(req.getTransferId());
        cmd.setPayload(req);
        cmd.setMsgTimestamp(new Date().getTime());
        cmd.setMsgId(req.getTransferId());

        return this.send(req.getTransferId(), cmd.toString());
    }

    public void destroy() {
        if (this.producer != null) {
            this.producer.flush();
            this.producer.close();
        }
    }
}
