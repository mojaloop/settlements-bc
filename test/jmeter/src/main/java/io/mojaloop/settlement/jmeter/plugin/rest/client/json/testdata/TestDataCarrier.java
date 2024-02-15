package io.mojaloop.settlement.jmeter.plugin.rest.client.json.testdata;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.ABaseJSONObject;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.batch.SettlementBatch;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix.SettlementMatrix;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferReq;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.json.JSONException;
import org.json.JSONObject;

@EqualsAndHashCode(callSuper = false)
@Data
public class TestDataCarrier extends ABaseJSONObject {
	private ABaseJSONObject request;
	private String requestRaw;
	private JSONObject response;
	private String responseRaw;
	private ActionType actionType;

	public enum ActionType {
		transfer,
		transfers_by_matrix_id,//TODO need to support on settlement TB.
		transfers_by_batch_id,//TODO need to support on settlement TB.
		get_batches_by_model,
		create_static_matrix,
		get_static_matrix,
		create_dynamic_matrix_model,
		get_dynamic_matrix_model,
		add_batch_to_static_matrix,
		remove_batch_from_static_matrix,
		matrix_recalculate,
		matrix_close,
		matrix_dispute,
		matrix_lock,
		matrix_unlock,
		matrix_settle,
		transfer_raw
	}

	public static class JSONMapping {
		public static final String REQUEST = "request";
		public static final String RESPONSE = "response";
		public static final String ACTION_TYPE = "actionType";
	}

	/**
	 * Populates local variables with {@code jsonObject}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public TestDataCarrier(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.ACTION_TYPE)) {
			this.setActionType(ActionType.valueOf(jsonObject.getString(JSONMapping.ACTION_TYPE)));
			switch (this.getActionType()) {
				case transfer:
					if (!jsonObject.isNull(JSONMapping.REQUEST)) this.setRequest(new TransferReq(jsonObject.getJSONObject(JSONMapping.REQUEST)));
					if (!jsonObject.isNull(JSONMapping.RESPONSE)) this.setResponse(jsonObject.getJSONObject(JSONMapping.RESPONSE));
				break;
				case get_batches_by_model:
				case add_batch_to_static_matrix:
				case remove_batch_from_static_matrix:
					if (!jsonObject.isNull(JSONMapping.REQUEST)) this.setRequest(new SettlementBatch(jsonObject.getJSONObject(JSONMapping.REQUEST)));
					if (!jsonObject.isNull(JSONMapping.RESPONSE)) this.setResponse(jsonObject.getJSONObject(JSONMapping.RESPONSE));
				break;
				case create_static_matrix:
				case get_static_matrix:
				case get_dynamic_matrix_model:
				case create_dynamic_matrix_model:
					if (!jsonObject.isNull(JSONMapping.REQUEST)) this.setRequest(new SettlementMatrix(jsonObject.getJSONObject(JSONMapping.REQUEST)));
					if (!jsonObject.isNull(JSONMapping.RESPONSE)) this.setResponse(jsonObject.getJSONObject(JSONMapping.RESPONSE));
				break;
			}
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getActionType() == null) returnVal.put(JSONMapping.ACTION_TYPE, JSONObject.NULL);
		else returnVal.put(JSONMapping.ACTION_TYPE, this.getActionType().name());

		switch (this.getActionType()) {
			case transfer:
			case get_batches_by_model:
			case create_static_matrix:
			case get_static_matrix:
			case create_dynamic_matrix_model:
			case get_dynamic_matrix_model:
			case add_batch_to_static_matrix:
			case remove_batch_from_static_matrix:
				if (this.getRequest() == null) returnVal.put(JSONMapping.REQUEST, JSONObject.NULL);
				else returnVal.put(JSONMapping.REQUEST, this.getRequest().toJsonObject());
			break;
			case transfer_raw:
				if (this.getRequestRaw() == null) returnVal.put(JSONMapping.REQUEST, JSONObject.NULL);
				else returnVal.put(JSONMapping.REQUEST, this.getRequestRaw());
			break;
		}

		if (this.getResponse() == null) returnVal.put(JSONMapping.RESPONSE, JSONObject.NULL);
		else returnVal.put(JSONMapping.RESPONSE, this.getResponse());

		return returnVal;
	}
}


