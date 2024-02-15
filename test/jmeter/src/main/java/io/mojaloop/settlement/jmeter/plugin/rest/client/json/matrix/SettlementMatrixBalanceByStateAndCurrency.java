package io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix;

import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * POJO used for a settlement batch {@code /matrices}
 */
@Getter
@Setter
public class SettlementMatrixBalanceByStateAndCurrency extends SettlementMatrixBalanceByCurrency {
	public static final long serialVersionUID = 1L;

	private String state;

	public static class JSONMapping {
		public static final String STATE = "state";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public SettlementMatrixBalanceByStateAndCurrency(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.STATE) && !jsonObject.isNull(JSONMapping.STATE)) {
			this.setState(jsonObject.getString(JSONMapping.STATE));
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getState() == null) returnVal.put(JSONMapping.STATE, JSONObject.NULL);
		else returnVal.put(JSONMapping.STATE, this.getState());

		return returnVal;
	}
}
