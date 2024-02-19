package io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/**
 * POJO used for a settlement batch {@code /matrices}
 */
@Getter
@Setter
public class CreateDynamicSettlementMatrix extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String matrixId;
	private Date fromDate;
	private Date toDate;
	private List<String> currencyCodes;
	private String settlementModel;
	private List<String> batchStatuses;
	private SettlementMatrix.Type type;

	public static class JSONMapping {
		public static final String MATRIX_ID = "matrixId";
		public static final String FROM_DATE = "fromDate";
		public static final String TO_DATE = "toDate";
		public static final String CURRENCY_CODES = "currencyCodes";
		public static final String SETTLEMENT_MODEL = "settlementModel";
		public static final String BATCH_STATUSES = "batchStatuses";
		public static final String TYPE = "type";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public CreateDynamicSettlementMatrix(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.MATRIX_ID) && !jsonObject.isNull(JSONMapping.MATRIX_ID)) {
			this.setMatrixId(jsonObject.getString(JSONMapping.MATRIX_ID));
		}
		if (jsonObject.has(JSONMapping.FROM_DATE) && !jsonObject.isNull(JSONMapping.FROM_DATE)) {
			this.setFromDate(new Date(jsonObject.getLong(JSONMapping.FROM_DATE)));
		}
		if (jsonObject.has(JSONMapping.TO_DATE) && !jsonObject.isNull(JSONMapping.TO_DATE)) {
			this.setToDate(new Date(jsonObject.getLong(JSONMapping.TO_DATE)));
		}
		this.setCurrencyCodes(new ArrayList<>());
		if (jsonObject.has(JSONMapping.CURRENCY_CODES) && !jsonObject.isNull(JSONMapping.CURRENCY_CODES)) {
			JSONArray cc = jsonObject.getJSONArray(JSONMapping.CURRENCY_CODES);
			for (int index = 0;index < cc.length();index++) this.getCurrencyCodes().add(cc.getString(index));
		}
		if (jsonObject.has(JSONMapping.SETTLEMENT_MODEL) && !jsonObject.isNull(JSONMapping.SETTLEMENT_MODEL)) {
			this.setSettlementModel(jsonObject.getString(JSONMapping.SETTLEMENT_MODEL));
		}
		this.setBatchStatuses(new ArrayList<>());
		if (jsonObject.has(JSONMapping.BATCH_STATUSES) && !jsonObject.isNull(JSONMapping.BATCH_STATUSES)) {
			JSONArray bs = jsonObject.getJSONArray(JSONMapping.BATCH_STATUSES);
			for (int index = 0;index < bs.length();index++) this.getBatchStatuses().add(bs.getString(index));
		}
		if (jsonObject.has(JSONMapping.TYPE) && !jsonObject.isNull(JSONMapping.TYPE)) {
			this.setType(jsonObject.getEnum(SettlementMatrix.Type.class, JSONMapping.TYPE));
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getMatrixId() == null) returnVal.put(JSONMapping.MATRIX_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.MATRIX_ID, this.getMatrixId());

		if (this.getFromDate() == null) returnVal.put(JSONMapping.FROM_DATE, JSONObject.NULL);
		else returnVal.put(JSONMapping.FROM_DATE, this.getFromDate().getTime());

		if (this.getToDate() == null) returnVal.put(JSONMapping.TO_DATE, JSONObject.NULL);
		else returnVal.put(JSONMapping.TO_DATE, this.getFromDate().getTime());

		if (this.getCurrencyCodes() == null) returnVal.put(JSONMapping.CURRENCY_CODES, JSONObject.NULL);
		else {
			JSONArray cc = new JSONArray();
			this.getCurrencyCodes().forEach(cc::put);
			returnVal.put(JSONMapping.CURRENCY_CODES, cc);
		}

		if (this.getSettlementModel() == null) returnVal.put(JSONMapping.SETTLEMENT_MODEL, JSONObject.NULL);
		else returnVal.put(JSONMapping.SETTLEMENT_MODEL, this.getSettlementModel());

		if (this.getType() == null) returnVal.put(JSONMapping.TYPE, JSONObject.NULL);
		else returnVal.put(JSONMapping.TYPE, this.getType());

		if (this.getBatchStatuses() == null) returnVal.put(JSONMapping.BATCH_STATUSES, JSONObject.NULL);
		else {
			JSONArray cc = new JSONArray();
			this.getBatchStatuses().forEach(cc::put);
			returnVal.put(JSONMapping.BATCH_STATUSES, cc);
		}

		if (this.getType() == null) returnVal.put(JSONMapping.TYPE, JSONObject.NULL);
		else returnVal.put(JSONMapping.TYPE, this.getType());

		return returnVal;
	}
}
