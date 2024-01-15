package io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Date;

/**
 * POJO used for a settlement {@code /transfer}
 */
@Getter
@Setter
public class TransferReq extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String transferId;
	private String payerFspId;
	private String payeeFspId;
	private String currencyCode;
	private String amount;
	private Date timestamp;
	private String settlementModel;


	public static class JSONMapping {
		public static final String TRANSFER_ID = "transferId";
		public static final String PAYER_FSP_ID = "payerFspId";
		public static final String PAYEE_FSP_ID = "payeeFspId";
		public static final String CURRENCY_CODE = "currencyCode";
		public static final String AMOUNT = "amount";
		public static final String TIMESTAMP = "timestamp";
		public static final String SETTLEMENT_MODEL = "settlementModel";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public TransferReq(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.TRANSFER_ID)) {
			this.setTransferId(jsonObject.getString(JSONMapping.TRANSFER_ID));
		}
		if (jsonObject.has(JSONMapping.PAYER_FSP_ID)) {
			this.setPayerFspId(jsonObject.getString(JSONMapping.PAYER_FSP_ID));
		}
		if (jsonObject.has(JSONMapping.PAYEE_FSP_ID)) {
			this.setPayeeFspId(jsonObject.getString(JSONMapping.PAYEE_FSP_ID));
		}
		if (jsonObject.has(JSONMapping.CURRENCY_CODE)) {
			this.setCurrencyCode(jsonObject.getString(JSONMapping.CURRENCY_CODE));
		}
		if (jsonObject.has(JSONMapping.AMOUNT)) {
			this.setAmount(jsonObject.getString(JSONMapping.AMOUNT));
		}
		if (jsonObject.has(JSONMapping.TIMESTAMP)) {
			//this.setTimestamp(this.dateFrom(jsonObject, JSONMapping.TIMESTAMP));
			this.setTimestamp(new Date(jsonObject.getLong(JSONMapping.TIMESTAMP)));
		}
		if (jsonObject.has(JSONMapping.SETTLEMENT_MODEL)) {
			this.setSettlementModel(jsonObject.getString(JSONMapping.SETTLEMENT_MODEL));
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getTransferId() == null) returnVal.put(JSONMapping.TRANSFER_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.TRANSFER_ID, this.getTransferId());

		if (this.getPayerFspId() == null) returnVal.put(JSONMapping.PAYER_FSP_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.PAYER_FSP_ID, this.getPayerFspId());

		if (this.getPayeeFspId() == null) returnVal.put(JSONMapping.PAYEE_FSP_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.PAYEE_FSP_ID, this.getPayeeFspId());

		if (this.getCurrencyCode() == null) returnVal.put(JSONMapping.CURRENCY_CODE, JSONObject.NULL);
		else returnVal.put(JSONMapping.CURRENCY_CODE, this.getCurrencyCode());

		if (this.getAmount() == null) returnVal.put(JSONMapping.AMOUNT, JSONObject.NULL);
		else returnVal.put(JSONMapping.AMOUNT, this.getAmount());

		if (this.getTimestamp() == null) returnVal.put(JSONMapping.TIMESTAMP, JSONObject.NULL);
		//else returnVal.put(JSONMapping.TIMESTAMP, new SimpleDateFormat(DATE_AND_TIME_FORMAT).format(this.getTimestamp()));
		else returnVal.put(JSONMapping.TIMESTAMP, this.getTimestamp().getTime());

		if (this.getSettlementModel() == null) returnVal.put(JSONMapping.SETTLEMENT_MODEL, JSONObject.NULL);
		else returnVal.put(JSONMapping.SETTLEMENT_MODEL, this.getSettlementModel());

		return returnVal;
	}
}
