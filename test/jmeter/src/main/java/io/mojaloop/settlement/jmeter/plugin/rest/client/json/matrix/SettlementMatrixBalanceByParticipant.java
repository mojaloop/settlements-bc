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
public class SettlementMatrixBalanceByParticipant extends SettlementMatrixBalanceByStateAndCurrency {
	public static final long serialVersionUID = 1L;

	private String participantId;

	public static class JSONMapping {
		public static final String PARTICIPANT_ID = "participantId";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public SettlementMatrixBalanceByParticipant(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.PARTICIPANT_ID) &&
				!jsonObject.isNull(JSONMapping.PARTICIPANT_ID)) {
			this.setParticipantId(jsonObject.getString(JSONMapping.PARTICIPANT_ID));
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getState() == null) returnVal.put(JSONMapping.PARTICIPANT_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.PARTICIPANT_ID, this.getParticipantId());

		return returnVal;
	}
}
