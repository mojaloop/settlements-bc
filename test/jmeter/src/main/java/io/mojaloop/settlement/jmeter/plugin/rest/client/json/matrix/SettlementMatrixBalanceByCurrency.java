package io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * POJO used for a settlement batch {@code /matrices}
 */
@Getter
@Setter
public class SettlementMatrixBalanceByCurrency extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String currencyCode;
	private String debitBalance;
	private String creditBalance;

	public static class JSONMapping {
		public static final String CURRENCY_CODE = "currencyCode";
		public static final String DEBIT_BALANCE = "debitBalance";
		public static final String CREDIT_BALANCE = "creditBalance";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public SettlementMatrixBalanceByCurrency(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.CURRENCY_CODE) && !jsonObject.isNull(JSONMapping.CURRENCY_CODE)) {
			this.setCurrencyCode(jsonObject.getString(JSONMapping.CURRENCY_CODE));
		}
		if (jsonObject.has(JSONMapping.DEBIT_BALANCE) && !jsonObject.isNull(JSONMapping.DEBIT_BALANCE)) {
			this.setDebitBalance(jsonObject.getString(JSONMapping.DEBIT_BALANCE));
		}
		if (jsonObject.has(JSONMapping.CREDIT_BALANCE) && !jsonObject.isNull(JSONMapping.CREDIT_BALANCE)) {
			this.setCreditBalance(jsonObject.getString(JSONMapping.CREDIT_BALANCE));
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getCurrencyCode() == null) returnVal.put(JSONMapping.CURRENCY_CODE, JSONObject.NULL);
		else returnVal.put(JSONMapping.CURRENCY_CODE, this.getCurrencyCode());

		if (this.getDebitBalance() == null) returnVal.put(JSONMapping.DEBIT_BALANCE, JSONObject.NULL);
		else returnVal.put(JSONMapping.DEBIT_BALANCE, this.getDebitBalance());

		if (this.getCreditBalance() == null) returnVal.put(JSONMapping.CREDIT_BALANCE, JSONObject.NULL);
		else returnVal.put(JSONMapping.CREDIT_BALANCE, this.getCreditBalance());

		return returnVal;
	}
}
