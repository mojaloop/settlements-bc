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

	@Getter
	@Setter
	public static final class SettlementTransfer extends ABaseJSONObject {
		private static final long serialVersionUID = 1L;
		private int count;
		private int amountMin;
		private int amountMax;
		private List<String> currencies;
		private List<String> participants;

		public static class JSONMapping {
			public static final String COUNT = "count";
			public static final String AMOUNT_MIN_MAX = "amount-min-max";
			public static final String CURRENCIES = "currencies";
			public static final String PARTICIPANTS = "participants";
		}

		public SettlementTransfer(JSONObject jsonObject) {
			super(jsonObject);
			this.currencies = new ArrayList<>();

			if (jsonObject.has(JSONMapping.COUNT)) {
				this.setCount(jsonObject.getInt(JSONMapping.COUNT));
			}
			if (jsonObject.has(JSONMapping.AMOUNT_MIN_MAX)) {
				JSONArray minMaxArr = jsonObject.getJSONArray(JSONMapping.AMOUNT_MIN_MAX);
				if (minMaxArr.length() > 0) this.amountMin = minMaxArr.getInt(0);
				if (minMaxArr.length() > 1) this.amountMax = minMaxArr.getInt(1);
			}

			if (jsonObject.has(JSONMapping.CURRENCIES)) {
				JSONArray arr = jsonObject.getJSONArray(JSONMapping.CURRENCIES);
				if (!arr.isEmpty()) arr.forEach(itm -> this.currencies.add(itm.toString()));
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
		}
	}

	public static class JSONMapping {
		public static final String TRANSACTION = "transaction";
		public static final String PARTIES = "parties";
		public static final String BANK_ACCOUNTS = "bank-accounts";
	}

	public TestPlanConfig(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.TRANSACTION)) {
			this.setSettlementTransfer(new SettlementTransfer(jsonObject.getJSONObject(JSONMapping.TRANSACTION)));
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		returnVal.put(JSONMapping.TRANSACTION, this.getSettlementTransfer());

		return returnVal;
	}

	public void validate() {
		if (this.getSettlementTransfer() == null) throw new IllegalStateException("Settlement Transfer is not set!");

		this.getSettlementTransfer().validate();
	}
}
