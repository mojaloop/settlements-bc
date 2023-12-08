package io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * POJO used for {@code /transfer} response.
 */
@Getter
@Setter
public class TransferRsp extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String respCode;

	public static class JSONMapping {
		public static final String RESPONSE_CODE = "respCode";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public TransferRsp(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.RESPONSE_CODE)) this.setRespCode(jsonObject.getString(JSONMapping.RESPONSE_CODE));
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getRespCode() == null) returnVal.put(JSONMapping.RESPONSE_CODE, JSONObject.NULL);
		else returnVal.put(JSONMapping.RESPONSE_CODE, this.getRespCode());

		return returnVal;
	}

	public boolean isSuccess() {
		String rspCode = this.getRespCode();
		if (rspCode == null) return false;

		switch (rspCode) {
			case "00000": return true;
			default: return false;
		}
	}
}
