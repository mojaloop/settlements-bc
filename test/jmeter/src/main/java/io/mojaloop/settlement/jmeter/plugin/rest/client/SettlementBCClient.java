package io.mojaloop.settlement.jmeter.plugin.rest.client;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferReq;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferRsp;
import org.apache.http.entity.ContentType;
import org.json.JSONObject;

/**
 * Rest client for making calls to Settlement-BC.
 */
public class SettlementBCClient extends ABaseRESTClient {

	public SettlementBCClient(String endpointBaseUrl) {
		super(endpointBaseUrl);
	}

	public TransferRsp settlementTransfer(TransferReq settleTransfer) {
		return new TransferRsp(this.postJson(settleTransfer, "/settlement_transfer"));
	}

	public JSONObject settlementTransferRaw(String rawTxt) {
		return this.executeString(
				HttpMethod.POST,
				null,
				rawTxt,
				ContentType.APPLICATION_JSON,
				"/settlement_transfer"
		);
	}
}
