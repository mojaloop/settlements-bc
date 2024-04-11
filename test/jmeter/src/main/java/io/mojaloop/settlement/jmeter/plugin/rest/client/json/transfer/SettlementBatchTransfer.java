package io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Date;

/**
 * POJO used for a settlement {@code /transfers}
 */
@Getter
@Setter
public class SettlementBatchTransfer extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String transferId;
	private Date transferTimestamp;
	private String payerFspId;
	private String payeeFspId;
	private String currencyCode;
	private String amount;
	private String batchId;
	private String batchName;
	private String journalEntryId;
	private String matrixId;

	public static class JSONMapping {
		public static final String TRANSFER_ID = "transferId";
		public static final String TIMESTAMP = "transferTimestamp";
		public static final String PAYER_FSP_ID = "payerFspId";
		public static final String PAYEE_FSP_ID = "payeeFspId";
		public static final String CURRENCY_CODE = "currencyCode";
		public static final String AMOUNT = "amount";
		public static final String BATCH_ID = "batchId";
		public static final String BATCH_NAME = "batchName";
		public static final String JOURNAL_ENTRY_ID = "journalEntryId";
		public static final String MATRIX_ID = "matrixId";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public SettlementBatchTransfer(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.TRANSFER_ID) && !jsonObject.isNull(JSONMapping.TRANSFER_ID)) {
			this.setTransferId(jsonObject.getString(JSONMapping.TRANSFER_ID));
		}
		if (jsonObject.has(JSONMapping.TIMESTAMP) && !jsonObject.isNull(JSONMapping.TIMESTAMP)) {
			this.setTransferTimestamp(new Date(jsonObject.getLong(JSONMapping.TIMESTAMP)));
		}
		if (jsonObject.has(JSONMapping.PAYER_FSP_ID) && !jsonObject.isNull(JSONMapping.PAYER_FSP_ID)) {
			this.setPayerFspId(jsonObject.getString(JSONMapping.PAYER_FSP_ID));
		}
		if (jsonObject.has(JSONMapping.PAYEE_FSP_ID) && !jsonObject.isNull(JSONMapping.PAYEE_FSP_ID)) {
			this.setPayeeFspId(jsonObject.getString(JSONMapping.PAYEE_FSP_ID));
		}
		if (jsonObject.has(JSONMapping.CURRENCY_CODE) && !jsonObject.isNull(JSONMapping.CURRENCY_CODE)) {
			this.setCurrencyCode(jsonObject.getString(JSONMapping.CURRENCY_CODE));
		}
		if (jsonObject.has(JSONMapping.AMOUNT) && !jsonObject.isNull(JSONMapping.AMOUNT)) {
			this.setAmount(jsonObject.getString(JSONMapping.AMOUNT));
		}
		if (jsonObject.has(JSONMapping.BATCH_ID) && !jsonObject.isNull(JSONMapping.BATCH_ID)) {
			this.setBatchId(jsonObject.getString(JSONMapping.BATCH_ID));
		}
		if (jsonObject.has(JSONMapping.BATCH_NAME) && !jsonObject.isNull(JSONMapping.BATCH_NAME)) {
			this.setBatchName(jsonObject.getString(JSONMapping.BATCH_NAME));
		}
		if (jsonObject.has(JSONMapping.JOURNAL_ENTRY_ID) && !jsonObject.isNull(JSONMapping.JOURNAL_ENTRY_ID)) {
			this.setJournalEntryId(jsonObject.getString(JSONMapping.JOURNAL_ENTRY_ID));
		}
		if (jsonObject.has(JSONMapping.MATRIX_ID) && !jsonObject.isNull(JSONMapping.MATRIX_ID)) {
			this.setMatrixId(jsonObject.getString(JSONMapping.MATRIX_ID));
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getTransferId() == null) returnVal.put(JSONMapping.TRANSFER_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.TRANSFER_ID, this.getTransferId());

		if (this.getTransferTimestamp() == null) returnVal.put(JSONMapping.TIMESTAMP, JSONObject.NULL);
		else returnVal.put(JSONMapping.TIMESTAMP, this.getTransferTimestamp().getTime());

		if (this.getPayerFspId() == null) returnVal.put(JSONMapping.PAYER_FSP_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.PAYER_FSP_ID, this.getPayerFspId());

		if (this.getPayeeFspId() == null) returnVal.put(JSONMapping.PAYEE_FSP_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.PAYEE_FSP_ID, this.getPayeeFspId());

		if (this.getCurrencyCode() == null) returnVal.put(JSONMapping.CURRENCY_CODE, JSONObject.NULL);
		else returnVal.put(JSONMapping.CURRENCY_CODE, this.getCurrencyCode());

		if (this.getAmount() == null) returnVal.put(JSONMapping.AMOUNT, JSONObject.NULL);
		else returnVal.put(JSONMapping.AMOUNT, this.getAmount());

		if (this.getBatchId() == null) returnVal.put(JSONMapping.BATCH_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.BATCH_ID, this.getBatchId());

		if (this.getBatchName() == null) returnVal.put(JSONMapping.BATCH_NAME, JSONObject.NULL);
		else returnVal.put(JSONMapping.BATCH_NAME, this.getBatchName());

		if (this.getJournalEntryId() == null) returnVal.put(JSONMapping.JOURNAL_ENTRY_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.JOURNAL_ENTRY_ID, this.getJournalEntryId());

		if (this.getMatrixId() == null) returnVal.put(JSONMapping.MATRIX_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.MATRIX_ID, this.getMatrixId());

		return returnVal;
	}
}
