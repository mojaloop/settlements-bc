package io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;

/**
 * POJO used for {@code /transfer}
 */
@Getter
@Setter
public class TransferReq extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private String requestId;
	private Date timestamp;


	public static class JSONMapping {
		public static final String REQUEST_ID = "requestId";
		public static final String TIMESTAMP = "timestamp";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public TransferReq(JSONObject jsonObject) {
		super(jsonObject);

		if (jsonObject.has(JSONMapping.REQUEST_ID)) this.setRequestId(jsonObject.getString(JSONMapping.REQUEST_ID));
		if (jsonObject.has(JSONMapping.TIMESTAMP)) {
			this.setTimestamp(this.dateFrom(jsonObject, JSONMapping.TIMESTAMP));
		}

		//TODO need to add the ability to create a fund transfer from JSON obj.
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();

		if (this.getRequestId() == null) returnVal.put(JSONMapping.REQUEST_ID, JSONObject.NULL);
		else returnVal.put(JSONMapping.REQUEST_ID, this.getRequestId());

		if (this.getTimestamp() == null) returnVal.put(JSONMapping.TIMESTAMP, JSONObject.NULL);
		else returnVal.put(JSONMapping.TIMESTAMP, new SimpleDateFormat(DATE_AND_TIME_FORMAT).format(this.getTimestamp()));

		return returnVal;
	}
}
