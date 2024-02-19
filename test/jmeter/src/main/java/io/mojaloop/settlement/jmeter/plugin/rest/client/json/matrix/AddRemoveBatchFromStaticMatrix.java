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
 * POJO used for adding and removing a settlement batch from a static settlement matrix.
 */
@Getter
@Setter
public class AddRemoveBatchFromStaticMatrix extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String matrixId;
	private List<String> batchIds;

	public static class JSONMapping {
		public static final String MATRIX_ID = "matrixId";
		public static final String BATCH_IDS = "batchIds";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public AddRemoveBatchFromStaticMatrix(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.MATRIX_ID) && !jsonObject.isNull(JSONMapping.MATRIX_ID)) {
			this.setMatrixId(jsonObject.getString(JSONMapping.MATRIX_ID));
		}
		this.setBatchIds(new ArrayList<>());
		if (jsonObject.has(JSONMapping.BATCH_IDS) && !jsonObject.isNull(JSONMapping.BATCH_IDS)) {
			JSONArray cc = jsonObject.getJSONArray(JSONMapping.BATCH_IDS);
			for (int index = 0;index < cc.length();index++) this.getBatchIds().add(cc.getString(index));
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getMatrixId() == null) returnVal.put(JSONMapping.MATRIX_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.MATRIX_ID, this.getMatrixId());

		if (this.getBatchIds() == null) returnVal.put(JSONMapping.BATCH_IDS, JSONObject.NULL);
		else {
			JSONArray bids = new JSONArray();
			this.getBatchIds().forEach(bids::put);
			returnVal.put(JSONMapping.BATCH_IDS, bids);
		}

		return returnVal;
	}
}
