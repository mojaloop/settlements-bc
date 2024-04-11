package io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

@Getter
@Setter
public class ProcessTransferCmd extends ABaseJSONObject {
    public static final long serialVersionUID = 1L;
    /*
    "STATE_EVENT" = 0,
    "STATE_SNAPSHOT" = 1,
    "DOMAIN_EVENT" = 2,
    "COMMAND" = 3,
    "DOMAIN_ERROR_EVENT" = 4
     */
    private Integer msgType = 3;
    private Integer msgOffset;
    private Integer msgPartition;
    private String msgName = "ProcessTransferCmd";
    private String msgId;
    private Long msgTimestamp;

    private String boundedContextName = "SettlementsBc";
    private String aggregateId;
    private String aggregateName = "Settlements";
    private String msgKey;
    private String msgTopic = "SettlementsBcCommands";
    private String fspiopOpaqueState;
    private TransferReq payload;

    public static class JSONMapping {
        public static final String MESSAGE_TYPE = "msgType";
        public static final String MESSAGE_NAME = "msgName";
        public static final String MESSAGE_ID = "msgId";
        public static final String MESSAGE_TIMESTAMP = "msgTimestamp";
        public static final String BOUND_CONT_NAME = "boundedContextName";
        public static final String AGGREGATE_ID = "aggregateId";
        public static final String AGGREGATE_NAME = "aggregateName";
        public static final String MSG_KEY = "msgKey";
        public static final String MSG_TOPIC = "msgTopic";
        public static final String PAYLOAD = "payload";

    }

    /**
     * Populates local variables with {@code jsonObjectParam}.
     *
     * @param jsonObject The JSON Object.
     */
    public ProcessTransferCmd(org.json.JSONObject jsonObject) {
        super(jsonObject);

        if (jsonObject.has(JSONMapping.MSG_KEY)) {
            this.setMsgKey(jsonObject.getString(JSONMapping.MSG_KEY));
        }
    }

    @Override
    public org.json.JSONObject toJsonObject() throws JSONException {
        JSONObject returnVal = super.toJsonObject();

        if (this.getMsgType() == null) returnVal.put(JSONMapping.MESSAGE_TYPE, JSONObject.NULL);
        else returnVal.put(JSONMapping.MESSAGE_TYPE, this.getMsgType());

        if (this.getMsgName() == null) returnVal.put(JSONMapping.MESSAGE_NAME, JSONObject.NULL);
        else returnVal.put(JSONMapping.MESSAGE_NAME, this.getMsgName());

        if (this.getMsgId() == null) returnVal.put(JSONMapping.MESSAGE_ID, JSONObject.NULL);
        else returnVal.put(JSONMapping.MESSAGE_ID, this.getMsgId());

        if (this.getMsgTimestamp() == null) returnVal.put(JSONMapping.MESSAGE_TIMESTAMP, JSONObject.NULL);
        else returnVal.put(JSONMapping.MESSAGE_TIMESTAMP, this.getMsgTimestamp());

        if (this.getBoundedContextName() == null) returnVal.put(JSONMapping.BOUND_CONT_NAME, JSONObject.NULL);
        else returnVal.put(JSONMapping.BOUND_CONT_NAME, this.getBoundedContextName());

        if (this.getAggregateId() == null) returnVal.put(JSONMapping.AGGREGATE_ID, JSONObject.NULL);
        else returnVal.put(JSONMapping.AGGREGATE_ID, this.getAggregateId());

        if (this.getAggregateName() == null) returnVal.put(JSONMapping.AGGREGATE_NAME, JSONObject.NULL);
        else returnVal.put(JSONMapping.AGGREGATE_NAME, this.getAggregateName());

        if (this.getMsgKey() == null) returnVal.put(JSONMapping.MSG_KEY, JSONObject.NULL);
        else returnVal.put(JSONMapping.MSG_KEY, this.getMsgKey());

        if (this.getMsgTopic() == null) returnVal.put(JSONMapping.MSG_TOPIC, JSONObject.NULL);
        else returnVal.put(JSONMapping.MSG_TOPIC, this.getMsgTopic());

        if (this.getPayload() == null) returnVal.put(JSONMapping.PAYLOAD, JSONObject.NULL);
        else returnVal.put(JSONMapping.PAYLOAD, this.getPayload().toJsonObject());

        return returnVal;
    }
}