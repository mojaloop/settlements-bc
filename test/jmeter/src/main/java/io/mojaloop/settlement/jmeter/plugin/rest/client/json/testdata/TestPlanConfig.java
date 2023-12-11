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

	@Getter
	@Setter
	public static final class SettlementTransfer extends ABaseJSONObject {
		private static final long serialVersionUID = 1L;
		private int count;
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
		private int closeBatchesEveryXSeconds;
		private int settleBatchesEveryXSeconds;

		public static class JSONMapping {
			public static final String CLOSE_BATCHES_EVERY_X_SECONDS = "close-batches-every-x-seconds";
			public static final String SETTLE_BATCHES_EVERY_X_SECONDS = "settle-batches-every-x-seconds";
		}

		public SettlementMatrix(JSONObject jsonObject) {
			super(jsonObject);

			if (jsonObject.has(JSONMapping.CLOSE_BATCHES_EVERY_X_SECONDS)) {
				this.setCloseBatchesEveryXSeconds(jsonObject.getInt(JSONMapping.CLOSE_BATCHES_EVERY_X_SECONDS));
			}

			if (jsonObject.has(JSONMapping.SETTLE_BATCHES_EVERY_X_SECONDS)) {
				this.setSettleBatchesEveryXSeconds(jsonObject.getInt(JSONMapping.SETTLE_BATCHES_EVERY_X_SECONDS));
			}
		}

		public void validate() {
			if (this.closeBatchesEveryXSeconds < 1) {
				throw new IllegalStateException("Closing of matrices needs to be more than 0!");
			}
			if (this.settleBatchesEveryXSeconds < 1) {
				throw new IllegalStateException("Settling of matrices needs to be more than 0!");
			}
		}
	}

	public static class JSONMapping {
		public static final String SETTLEMENT_TRANSFER = "settlement-transfer";
		public static final String SETTLEMENT_MATRIX = "settlement-matrix";
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
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		returnVal.put(JSONMapping.SETTLEMENT_TRANSFER, this.getSettlementTransfer());
		returnVal.put(JSONMapping.SETTLEMENT_MATRIX, this.getSettlementMatrix());

		return returnVal;
	}

	public void validate() {
		if (this.getSettlementTransfer() == null) throw new IllegalStateException("Settlement Transfer is not set!");
		if (this.getSettlementMatrix() == null) throw new IllegalStateException("Settlement Matrix is not set!");

		this.getSettlementTransfer().validate();
		this.getSettlementMatrix().validate();
	}
}
