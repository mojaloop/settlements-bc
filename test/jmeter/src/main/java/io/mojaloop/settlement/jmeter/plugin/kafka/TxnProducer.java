package io.mojaloop.settlement.jmeter.plugin.kafka;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.ProcessTransferCmd;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferReq;
import org.apache.kafka.clients.ClientDnsLookup;
import org.apache.kafka.clients.producer.*;
import org.apache.kafka.common.serialization.StringSerializer;
import org.json.JSONObject;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Date;
import java.util.Properties;
import java.util.concurrent.ExecutionException;

public class TxnProducer {
    private Producer<String, String> producer;
    private String topic;

    public void init(String url, String topic) {
        Properties props = new Properties();
        try {
            props.put(ProducerConfig.CLIENT_ID_CONFIG, String.format("mjl-stress-test-%s", InetAddress.getLocalHost().getHostName()));
        } catch (UnknownHostException eParam) {
            throw new IllegalStateException(eParam);
        }
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, url);//"localhost:9092"
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put("acks", "all");
        //props.put(ProducerConfig.CLIENT_DNS_LOOKUP_CONFIG, ClientDnsLookup.RESOLVE_CANONICAL_BOOTSTRAP_SERVERS_ONLY.toString());
        props.put(ProducerConfig.CLIENT_DNS_LOOKUP_CONFIG, ClientDnsLookup.USE_ALL_DNS_IPS.toString());

        this.topic = topic;
        this.producer = new KafkaProducer<>(props);
    }

    private RecordMetadata send(
            String key,
            String value
    ) throws ExecutionException, InterruptedException {
        final ProducerRecord<String, String> record = new ProducerRecord<>(this.topic, key, value);
        RecordMetadata metadata = this.producer.send(record, new Callback() {
            @Override
            public void onCompletion(RecordMetadata recordMetadataParam, Exception eParam) {
                //System.out.println("Sent! ["+recordMetadataParam.toString()+":"+eParam.getMessage()+"]");
            }
        }).get();
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
