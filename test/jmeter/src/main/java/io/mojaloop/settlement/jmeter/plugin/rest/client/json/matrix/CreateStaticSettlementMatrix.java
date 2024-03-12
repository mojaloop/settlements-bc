package io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * POJO used for a settlement batch {@code /matrices}
 */
@Getter
@Setter
public class CreateStaticSettlementMatrix extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String matrixId;
	private List<String> batchIds;
	private SettlementMatrix.Type type;

	public static class JSONMapping {
		public static final String MATRIX_ID = "matrixId";
		public static final String BATCH_IDS = "batchIds";
		public static final String TYPE = "type";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public CreateStaticSettlementMatrix(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.MATRIX_ID) && !jsonObject.isNull(JSONMapping.MATRIX_ID)) {
			this.setMatrixId(jsonObject.getString(JSONMapping.MATRIX_ID));
		}
		if (jsonObject.has(SettlementMatrix.JSONMapping.TYPE) && !jsonObject.isNull(SettlementMatrix.JSONMapping.TYPE)) {
			this.setType(jsonObject.getEnum(SettlementMatrix.Type.class, SettlementMatrix.JSONMapping.TYPE));
		}
		this.setBatchIds(new ArrayList<>());
		if (jsonObject.has(JSONMapping.BATCH_IDS) && !jsonObject.isNull(JSONMapping.BATCH_IDS)) {
			JSONArray cc = jsonObject.getJSONArray(JSONMapping.BATCH_IDS);
			for (int index = 0;index < cc.length();index++) this.getBatchIds().add(cc.getString(index));
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

		if (this.getType() == null) returnVal.put(SettlementMatrix.JSONMapping.TYPE, JSONObject.NULL);
		else returnVal.put(SettlementMatrix.JSONMapping.TYPE, this.getType());

		if (this.getBatchIds() == null) returnVal.put(JSONMapping.BATCH_IDS, JSONObject.NULL);
		else {
			JSONArray bids = new JSONArray();
			this.getBatchIds().forEach(bids::put);
			returnVal.put(JSONMapping.BATCH_IDS, bids);
		}

		if (this.getType() == null) returnVal.put(JSONMapping.TYPE, JSONObject.NULL);
		else returnVal.put(JSONMapping.TYPE, this.getType());

		return returnVal;
	}
}
