package io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.ABaseJSONObject;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.batch.SettlementBatch;
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
public class SettlementMatrix extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String id;
	private Date createdAt;
	private Date updatedAt;
	private Date dateFrom;
	private Date dateTo;
	private List<String> currencyCodes;
	private String settlementModel;
	private List<String> batchStatuses;
	private List<SettlementBatch> batches;
	private State state;
	private Type type;
	private int generationDurationSecs;
	private List<SettlementMatrixBalanceByCurrency> balancesByCurrency;

	public static enum Type {
		STATIC, DYNAMIC
	}

	public static enum State {
		IDLE, BUSY, FINALIZED, OUT_OF_SYNC, LOCKED
	}
	

	public static class JSONMapping {
		public static final String ID = "id";
		public static final String CREATED_AT = "createdAt";
		public static final String UPDATED_AT = "updatedAt";
		public static final String DATE_FROM = "dateFrom";
		public static final String DATE_TO = "dateTo";
		public static final String CURRENCY_CODES = "currencyCodes";
		public static final String SETTLEMENT_MODEL = "settlementModel";
		public static final String BATCH_STATUSES = "batchStatuses";
		public static final String BATCHES = "batches";
		public static final String STATE = "state";
		public static final String TYPE = "type";
		public static final String GENERATION_DURATION_SECS = "generationDurationSecs";
		public static final String BALANCES_BY_CURRENCY = "balancesByCurrency";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public SettlementMatrix(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.ID) && !jsonObject.isNull(JSONMapping.ID)) {
			this.setId(jsonObject.getString(JSONMapping.ID));
		}
		if (jsonObject.has(JSONMapping.CREATED_AT) && !jsonObject.isNull(JSONMapping.CREATED_AT)) {
			this.setCreatedAt(new Date(jsonObject.getLong(JSONMapping.CREATED_AT)));
		}
		if (jsonObject.has(JSONMapping.UPDATED_AT) && !jsonObject.isNull(JSONMapping.UPDATED_AT)) {
			this.setUpdatedAt(new Date(jsonObject.getLong(JSONMapping.UPDATED_AT)));
		}
		if (jsonObject.has(JSONMapping.DATE_FROM) && !jsonObject.isNull(JSONMapping.DATE_FROM)) {
			this.setDateFrom(new Date(jsonObject.getLong(JSONMapping.DATE_FROM)));
		}
		if (jsonObject.has(JSONMapping.DATE_TO) && !jsonObject.isNull(JSONMapping.DATE_TO)) {
			this.setDateTo(new Date(jsonObject.getLong(JSONMapping.DATE_TO)));
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
		this.setBatches(new ArrayList<>());
		if (jsonObject.has(JSONMapping.BATCHES) && !jsonObject.isNull(JSONMapping.BATCHES)) {
			JSONArray b = jsonObject.getJSONArray(JSONMapping.BATCHES);
			for (int index = 0;index < b.length();index++) this.getBatches().add(new SettlementBatch(b.getJSONObject(index)));
		}
		if (jsonObject.has(JSONMapping.STATE) && !jsonObject.isNull(JSONMapping.STATE)) {
			this.setState(jsonObject.getEnum(State.class, JSONMapping.STATE));
		}
		if (jsonObject.has(JSONMapping.TYPE) && !jsonObject.isNull(JSONMapping.TYPE)) {
			this.setType(jsonObject.getEnum(Type.class,JSONMapping.TYPE));
		}
		if (jsonObject.has(JSONMapping.GENERATION_DURATION_SECS) &&
				!jsonObject.isNull(JSONMapping.GENERATION_DURATION_SECS)) {
			this.setGenerationDurationSecs(jsonObject.getInt(JSONMapping.GENERATION_DURATION_SECS));
		}
		this.setBalancesByCurrency(new ArrayList<>());
		if (jsonObject.has(JSONMapping.BALANCES_BY_CURRENCY) &&
				!jsonObject.isNull(JSONMapping.BALANCES_BY_CURRENCY)) {
			JSONArray cc = jsonObject.getJSONArray(JSONMapping.BALANCES_BY_CURRENCY);
			for (int index = 0;index < cc.length();index++) this.getBalancesByCurrency().add(
					new SettlementMatrixBalanceByCurrency(cc.getJSONObject(index))
			);
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getId() == null) returnVal.put(JSONMapping.ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.ID, this.getId());

		if (this.getCreatedAt() == null) returnVal.put(JSONMapping.CREATED_AT, JSONObject.NULL);
		else returnVal.put(JSONMapping.CREATED_AT, this.getCreatedAt().getTime());

		if (this.getUpdatedAt() == null) returnVal.put(JSONMapping.UPDATED_AT, JSONObject.NULL);
		else returnVal.put(JSONMapping.UPDATED_AT, this.getUpdatedAt().getTime());

		if (this.getDateFrom() == null) returnVal.put(JSONMapping.DATE_FROM, JSONObject.NULL);
		else returnVal.put(JSONMapping.DATE_FROM, this.getDateFrom().getTime());

		if (this.getDateTo() == null) returnVal.put(JSONMapping.DATE_TO, JSONObject.NULL);
		else returnVal.put(JSONMapping.DATE_TO, this.getDateTo().getTime());

		if (this.getCurrencyCodes() == null) returnVal.put(JSONMapping.CURRENCY_CODES, JSONObject.NULL);
		else {
			JSONArray cc = new JSONArray();
			this.getCurrencyCodes().forEach(cc::put);
			returnVal.put(JSONMapping.CURRENCY_CODES, cc);
		}

		if (this.getSettlementModel() == null) returnVal.put(JSONMapping.SETTLEMENT_MODEL, JSONObject.NULL);
		else returnVal.put(JSONMapping.SETTLEMENT_MODEL, this.getSettlementModel());

		if (this.getBatchStatuses() == null) returnVal.put(JSONMapping.BATCH_STATUSES, JSONObject.NULL);
		else {
			JSONArray bs = new JSONArray();
			this.getBatchStatuses().forEach(bs::put);
			returnVal.put(JSONMapping.BATCH_STATUSES, bs);
		}

		if (this.getState() == null) returnVal.put(JSONMapping.STATE, JSONObject.NULL);
		else returnVal.put(JSONMapping.STATE, this.getState());

		if (this.getType() == null) returnVal.put(JSONMapping.TYPE, JSONObject.NULL);
		else returnVal.put(JSONMapping.TYPE, this.getType());

		return returnVal;
	}
}
