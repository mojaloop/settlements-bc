package io.mojaloop.settlement.jmeter.plugin.rest.client.json.batch;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Date;

/**
 * POJO used for a settlement batch {@code /batches}
 */
@Getter
@Setter
public class SettlementBatch extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String batchUUID;
	private String id;
	private Date timestamp;
	private String settlementModel;
	private String currencyCode;
	private String batchName;
	private int batchSequence;
	private String state;

	public static class JSONMapping {
		public static final String BATCH_UUID_ID = "batchUUID";
		public static final String ID = "id";
		public static final String TIMESTAMP = "timestamp";
		public static final String SETTLEMENT_MODEL = "settlementModel";
		public static final String CURRENCY_CODE = "currencyCode";
		public static final String BATCH_NAME = "batchName";
		public static final String BATCH_SEQUENCE = "batchSequence";
		public static final String STATE = "state";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public SettlementBatch(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.BATCH_UUID_ID)) {
			this.setBatchUUID(jsonObject.getString(JSONMapping.BATCH_UUID_ID));
		}
		if (jsonObject.has(JSONMapping.ID)) {
			this.setId(jsonObject.getString(JSONMapping.ID));
		}
		if (jsonObject.has(JSONMapping.TIMESTAMP)) {
			this.setTimestamp(new Date(jsonObject.getLong(JSONMapping.TIMESTAMP)));
		}
		if (jsonObject.has(JSONMapping.SETTLEMENT_MODEL)) {
			this.setSettlementModel(jsonObject.getString(JSONMapping.SETTLEMENT_MODEL));
		}
		if (jsonObject.has(JSONMapping.CURRENCY_CODE)) {
			this.setCurrencyCode(jsonObject.getString(JSONMapping.CURRENCY_CODE));
		}
		if (jsonObject.has(JSONMapping.BATCH_NAME)) {
			this.setBatchName(jsonObject.getString(JSONMapping.BATCH_NAME));
		}
		if (jsonObject.has(JSONMapping.BATCH_SEQUENCE)) {
			this.setBatchSequence(jsonObject.getInt(JSONMapping.BATCH_SEQUENCE));
		}
		if (jsonObject.has(JSONMapping.STATE)) {
			this.setState(jsonObject.getString(JSONMapping.STATE));
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getBatchUUID() == null) returnVal.put(JSONMapping.BATCH_UUID_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.BATCH_UUID_ID, this.getBatchUUID());

		if (this.getId() == null) returnVal.put(JSONMapping.ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.ID, this.getId());

		if (this.getTimestamp() == null) returnVal.put(JSONMapping.TIMESTAMP, JSONObject.NULL);
		else returnVal.put(JSONMapping.TIMESTAMP, this.getTimestamp().getTime());

		if (this.getSettlementModel() == null) returnVal.put(JSONMapping.SETTLEMENT_MODEL, JSONObject.NULL);
		else returnVal.put(JSONMapping.SETTLEMENT_MODEL, this.getSettlementModel());

		if (this.getCurrencyCode() == null) returnVal.put(JSONMapping.CURRENCY_CODE, JSONObject.NULL);
		else returnVal.put(JSONMapping.CURRENCY_CODE, this.getCurrencyCode());

		if (this.getBatchName() == null) returnVal.put(JSONMapping.BATCH_NAME, JSONObject.NULL);
		else returnVal.put(JSONMapping.BATCH_NAME, this.getBatchName());

		returnVal.put(JSONMapping.BATCH_SEQUENCE, this.getBatchSequence());

		if (this.getState() == null) returnVal.put(JSONMapping.STATE, JSONObject.NULL);
		else returnVal.put(JSONMapping.STATE, this.getState());

		return returnVal;
	}
}
