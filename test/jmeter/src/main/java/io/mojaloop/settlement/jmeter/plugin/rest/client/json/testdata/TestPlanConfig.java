package io.mojaloop.settlement.jmeter.plugin.rest.client.json.testdata;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Test plan configuration.
 */
@Getter
@Setter
public class TestPlanConfig extends ABaseJSONObject {
	private static final long serialVersionUID = 1L;

	private SettlementTransfer settlementTransfer;
	private SettlementMatrix settlementMatrix;
	private SettlementBatch settlementBatch;

	@Getter
	@Setter
	public static final class SettlementTransfer extends ABaseJSONObject {
		private static final long serialVersionUID = 1L;
		private int count;
		private int getByBatchId;
		private int getByMatrixId;
		private int amountMin;
		private int amountMax;
		private List<String> currencies;
		private List<String> settlementModels;
		private List<String> participants;

		public static class JSONMapping {
			public static final String COUNT = "count";
			public static final String MIN_MAX_AMOUNT = "min-max-amount";
			public static final String CURRENCIES = "currencies";
			public static final String SETTLEMENT_MODELS = "settlement-models";
			public static final String PARTICIPANTS = "participants";
			public static final String GET_BY_BATCH_ID = "get-by-batch-id";
			public static final String GET_BY_MATRIX_ID = "get-by-matrix-id";
		}

		public SettlementTransfer(JSONObject jsonObject) {
			super(jsonObject);
			this.currencies = new ArrayList<>();
			this.settlementModels = new ArrayList<>();
			this.participants = new ArrayList<>();

			if (jsonObject.has(JSONMapping.COUNT)) {
				this.setCount(jsonObject.getInt(JSONMapping.COUNT));
			}
			if (jsonObject.has(JSONMapping.MIN_MAX_AMOUNT)) {
				JSONArray minMaxArr = jsonObject.getJSONArray(JSONMapping.MIN_MAX_AMOUNT);
				if (!minMaxArr.isEmpty()) this.amountMin = minMaxArr.getInt(0);
				if (minMaxArr.length() > 1) this.amountMax = minMaxArr.getInt(1);
			}

			if (jsonObject.has(JSONMapping.CURRENCIES)) {
				JSONArray arr = jsonObject.getJSONArray(JSONMapping.CURRENCIES);
				if (!arr.isEmpty()) arr.forEach(itm -> this.currencies.add(itm.toString()));
			}

			if (jsonObject.has(JSONMapping.SETTLEMENT_MODELS)) {
				JSONArray arr = jsonObject.getJSONArray(JSONMapping.SETTLEMENT_MODELS);
				if (!arr.isEmpty()) arr.forEach(itm -> this.settlementModels.add(itm.toString()));
			}

			if (jsonObject.has(JSONMapping.PARTICIPANTS)) {
				JSONArray arr = jsonObject.getJSONArray(JSONMapping.PARTICIPANTS);
				if (!arr.isEmpty()) arr.forEach(itm -> this.participants.add(itm.toString()));
			}

			if (jsonObject.has(JSONMapping.GET_BY_BATCH_ID)) {
				this.setGetByBatchId(jsonObject.getInt(JSONMapping.GET_BY_BATCH_ID));
			}

			if (jsonObject.has(JSONMapping.GET_BY_MATRIX_ID)) {
				this.setGetByMatrixId(jsonObject.getInt(JSONMapping.GET_BY_MATRIX_ID));
			}
		}

		public void validate() {
			if (this.count < 1) throw new IllegalStateException("Count needs to be more than 0!");
			if (this.amountMin < 1) throw new IllegalStateException("Amount-min needs to be more than 0!");
			if (this.amountMax < 1) throw new IllegalStateException("Amount-max needs to be more than 0!");
			if (this.amountMin > this.amountMax) throw new IllegalStateException("Amount-min cannot be more than amount-max!");

			if (this.currencies == null || this.currencies.isEmpty()) {
				throw new IllegalStateException("At least one currency is required!");
			}

			if (this.settlementModels == null || this.settlementModels.isEmpty()) {
				throw new IllegalStateException("At least one settlement-model is required!");
			}

			if (this.participants == null || this.participants.isEmpty()) {
				throw new IllegalStateException("At least one participant is required!");
			}
		}
	}

	@Getter
	@Setter
	public static final class SettlementMatrix extends ABaseJSONObject {
		private static final long serialVersionUID = 1L;
		private int createStatic;
		private int addBatchToStatic;
		private int removeBatchFromStatic;
		private int getStatic;
		private int createDynamicModel;
		private int getDynamicModel;
		private int close;
		private int lock;
		private int settle;
		private int dispute;

		public static class JSONMapping {
			public static final String CREATE_STATIC = "create-static";
			public static final String ADD_BATCH_TO_STATIC = "add-batch-to-static";
			public static final String REMOVE_BATCH_FROM_STATIC = "remove-batch-from-static";
			public static final String GET_STATIC = "get-static";
			public static final String CREATE_DYNAMIC_MODEL = "create-dynamic-model";
			public static final String GET_DYNAMIC_MODEL = "get-dynamic-model";
			public static final String CLOSE = "close";
			public static final String LOCK = "lock";
			public static final String SETTLE = "settle";
			public static final String DISPUTE = "dispute";
		}

		public SettlementMatrix(JSONObject jsonObject) {
			super(jsonObject);

			if (jsonObject.has(JSONMapping.CREATE_STATIC)) {
				this.setCreateStatic(jsonObject.getInt(JSONMapping.CREATE_STATIC));
			}
			if (jsonObject.has(JSONMapping.ADD_BATCH_TO_STATIC)) {
				this.setAddBatchToStatic(jsonObject.getInt(JSONMapping.ADD_BATCH_TO_STATIC));
			}
			if (jsonObject.has(JSONMapping.REMOVE_BATCH_FROM_STATIC)) {
				this.setRemoveBatchFromStatic(jsonObject.getInt(JSONMapping.REMOVE_BATCH_FROM_STATIC));
			}
			if (jsonObject.has(JSONMapping.CREATE_STATIC)) {
				this.setCreateStatic(jsonObject.getInt(JSONMapping.CREATE_STATIC));
			}
			if (jsonObject.has(JSONMapping.GET_STATIC)) {
				this.setGetStatic(jsonObject.getInt(JSONMapping.GET_STATIC));
			}
			if (jsonObject.has(JSONMapping.CREATE_DYNAMIC_MODEL)) {
				this.setCreateDynamicModel(jsonObject.getInt(JSONMapping.CREATE_DYNAMIC_MODEL));
			}
			if (jsonObject.has(JSONMapping.GET_DYNAMIC_MODEL)) {
				this.setGetDynamicModel(jsonObject.getInt(JSONMapping.GET_DYNAMIC_MODEL));
			}
			if (jsonObject.has(JSONMapping.CLOSE)) {
				this.setClose(jsonObject.getInt(JSONMapping.CLOSE));
			}
			if (jsonObject.has(JSONMapping.LOCK)) {
				this.setLock(jsonObject.getInt(JSONMapping.LOCK));
			}
			if (jsonObject.has(JSONMapping.SETTLE)) {
				this.setSettle(jsonObject.getInt(JSONMapping.SETTLE));
			}
			if (jsonObject.has(JSONMapping.DISPUTE)) {
				this.setDispute(jsonObject.getInt(JSONMapping.DISPUTE));
			}
		}

		public void validate() {
			if (this.createStatic < 0) {
				throw new IllegalStateException("Create static matrix should be more than -1!");
			}
			if (this.getStatic < 0) {
				throw new IllegalStateException("Get static matrix should be more than -1!");
			}

			if (this.createDynamicModel < 0) {
				throw new IllegalStateException("Create dynamic matrix model should be more than -1!");
			}

			if (this.getDynamicModel < 0) {
				throw new IllegalStateException("Get dynamic model matrix model should be more than -1!");
			}

			if (this.close < 0) {
				throw new IllegalStateException("Close matrix should be more than -1!");
			}

			if (this.lock < 0) {
				throw new IllegalStateException("Lock matrix should be more than -1!");
			}

			if (this.settle < 0) {
				throw new IllegalStateException("Settle matrix should be more than -1!");
			}

			if (this.dispute < 0) {
				throw new IllegalStateException("Dispute matrix should be more than -1!");
			}
		}
	}

	@Getter
	@Setter
	public static final class SettlementBatch extends ABaseJSONObject {
		private static final long serialVersionUID = 1L;
		private int getByModel;

		public static class JSONMapping {
			public static final String GET_BY_MODEL = "get-by-model";
		}

		public SettlementBatch(JSONObject jsonObject) {
			super(jsonObject);

			if (jsonObject.has(JSONMapping.GET_BY_MODEL)) {
				this.setGetByModel(jsonObject.getInt(JSONMapping.GET_BY_MODEL));
			}
		}

		public void validate() {
			if (this.getByModel < 0) {
				throw new IllegalStateException("Closing of matrices needs to be more than 0!");
			}
		}
	}

	public static class JSONMapping {
		public static final String SETTLEMENT_TRANSFER = "settlement-transfer";
		public static final String SETTLEMENT_MATRIX = "settlement-matrix";
		public static final String BATCH = "batch";
	}

	public TestPlanConfig(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.SETTLEMENT_TRANSFER)) {
			this.setSettlementTransfer(new SettlementTransfer(
					jsonObject.getJSONObject(JSONMapping.SETTLEMENT_TRANSFER)));
		}

		if (jsonObject.has(JSONMapping.SETTLEMENT_MATRIX)) {
			this.setSettlementMatrix(new SettlementMatrix(
					jsonObject.getJSONObject(JSONMapping.SETTLEMENT_MATRIX)));
		}

		if (jsonObject.has(JSONMapping.BATCH)) {
			this.setSettlementBatch(new SettlementBatch(jsonObject.getJSONObject(JSONMapping.BATCH)));
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		returnVal.put(JSONMapping.SETTLEMENT_TRANSFER, this.getSettlementTransfer());
		returnVal.put(JSONMapping.SETTLEMENT_MATRIX, this.getSettlementMatrix());
		returnVal.put(JSONMapping.BATCH, this.getSettlementBatch());

		return returnVal;
	}

	public void validate() {
		if (this.getSettlementTransfer() == null) throw new IllegalStateException("Settlement Transfer is not set!");
		if (this.getSettlementMatrix() == null) throw new IllegalStateException("Settlement Matrix is not set!");
		if (this.getSettlementBatch() == null) throw new IllegalStateException("Settlement Batch is not set!");

		this.getSettlementTransfer().validate();
		this.getSettlementMatrix().validate();
		this.getSettlementBatch().validate();
	}
}
