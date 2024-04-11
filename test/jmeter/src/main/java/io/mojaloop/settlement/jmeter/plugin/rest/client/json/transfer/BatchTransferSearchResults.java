package io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.ABaseJSONObject;
import lombok.Getter;
import lombok.Setter;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * POJO used for a settlement batch search results {@code /transfers}
 * @see SettlementBatchTransfer
 */
@Getter
@Setter
public class BatchTransferSearchResults extends ABaseJSONObject {
	public static final long serialVersionUID = 1L;

	private List<SettlementBatchTransfer> items;

	public static class JSONMapping {
		public static final String ITEMS = "items";
	}

	/**
	 * Populates local variables with {@code jsonObjectParam}.
	 *
	 * @param jsonObject The JSON Object.
	 */
	public BatchTransferSearchResults(JSONObject jsonObject) {
		super(jsonObject);
		this.setItems(new ArrayList<>());

		if (jsonObject.has(JSONMapping.ITEMS)) {
			JSONArray itemsArr = jsonObject.getJSONArray(JSONMapping.ITEMS);
			for (int index = 0;index < itemsArr.length();index++) {
				JSONObject objAtIndex = itemsArr.getJSONObject(index);
				this.getItems().add(new SettlementBatchTransfer(objAtIndex));
			}
		}
	}

	@Override
	public JSONObject toJsonObject() throws JSONException {
		JSONObject returnVal = super.toJsonObject();
		JSONArray items = new JSONArray();
		if (this.getItems() != null) {
			this.getItems().forEach(itm -> items.put(itm.toJsonObject()));
		}
		returnVal.put(JSONMapping.ITEMS, items);
		return returnVal;
	}
}
