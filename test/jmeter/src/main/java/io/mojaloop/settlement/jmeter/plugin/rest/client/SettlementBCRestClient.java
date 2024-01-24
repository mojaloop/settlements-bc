package io.mojaloop.settlement.jmeter.plugin.rest.client;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferReq;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferRsp;
import org.apache.http.entity.ContentType;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Rest client for making calls to Settlement-BC.
 */
public class SettlementBCRestClient extends ABaseRESTClient {

	public SettlementBCRestClient(String endpointBaseUrl) {
		super(endpointBaseUrl);
	}

	public TransferRsp settlementTransfer(TransferReq settleTransfer) {
		List<HeaderNameValue> headers = new ArrayList<>();
		headers.add(new HeaderNameValue("X-Correlation-ID", UUID.randomUUID().toString()));
		headers.add(new HeaderNameValue("Authorization", "Bearer {{access_token}}"));
		headers.add(new HeaderNameValue(CONTENT_TYPE_HEADER, ContentType.APPLICATION_JSON.getMimeType()));

		return new TransferRsp(this.postJson(headers, settleTransfer, "/transfers"));
	}

	public JSONObject settlementTransferRaw(String rawTxt) {
		return this.executeString(
				HttpMethod.POST,
				null,
				rawTxt,
				ContentType.APPLICATION_JSON,
				"/transfers"
		);
	}
}
