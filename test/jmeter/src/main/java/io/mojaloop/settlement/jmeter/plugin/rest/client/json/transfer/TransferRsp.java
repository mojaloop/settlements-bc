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

	private String batchId;

	public static class JSONMapping {
		public static final String BATCH_ID = "batchId";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public TransferRsp(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.BATCH_ID)) this.setBatchId(jsonObject.getString(JSONMapping.BATCH_ID));
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getBatchId() == null) returnVal.put(JSONMapping.BATCH_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.BATCH_ID, this.getBatchId());

		return returnVal;
	}

	public boolean isSuccess() {
		String rspCode = this.getBatchId();
		if (rspCode == null) return false;
		return true;
	}
}
