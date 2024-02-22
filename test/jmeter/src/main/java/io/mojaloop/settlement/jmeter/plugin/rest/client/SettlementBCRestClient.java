package io.mojaloop.settlement.jmeter.plugin.rest.client;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.batch.BatchSearchResults;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix.AddRemoveBatchFromStaticMatrix;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix.CreateDynamicSettlementMatrix;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix.CreateStaticSettlementMatrix;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix.SettlementMatrix;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.testdata.TestDataCarrier;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.BatchTransferSearchResults;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferReq;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferRsp;
import org.apache.http.entity.ContentType;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

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

	public BatchSearchResults settlementBatches(
			String settlementModel,
			int timeBackInMinutes
	) {
		List<HeaderNameValue> headers = new ArrayList<>();
		headers.add(new HeaderNameValue("X-Correlation-ID", UUID.randomUUID().toString()));
		headers.add(new HeaderNameValue("Authorization", "Bearer {{access_token}}"));
		headers.add(new HeaderNameValue(CONTENT_TYPE_HEADER, ContentType.APPLICATION_JSON.getMimeType()));

		long toDate = System.currentTimeMillis();
		long fromDate = (toDate - TimeUnit.MINUTES.toMillis(timeBackInMinutes));//1674140933634l|Thu Jan 19 16:08:53 CET 2023

		String url = String.format("/batches?settlementModel=%s&fromDate=%d&toDate=%d",
				settlementModel, fromDate, toDate);
		return new BatchSearchResults(this.getJson(url, headers));
	}

	public CreateStaticSettlementMatrix createMatrix(CreateStaticSettlementMatrix matrix) {
		List<HeaderNameValue> headers = new ArrayList<>();
		headers.add(new HeaderNameValue("X-Correlation-ID", UUID.randomUUID().toString()));
		headers.add(new HeaderNameValue("Authorization", "Bearer {{access_token}}"));
		headers.add(new HeaderNameValue(CONTENT_TYPE_HEADER, ContentType.APPLICATION_JSON.getMimeType()));

		return new CreateStaticSettlementMatrix(this.postJson(headers, matrix, "/matrices"));
	}

	public CreateDynamicSettlementMatrix createMatrix(CreateDynamicSettlementMatrix matrix) {
		List<HeaderNameValue> headers = new ArrayList<>();
		headers.add(new HeaderNameValue("X-Correlation-ID", UUID.randomUUID().toString()));
		headers.add(new HeaderNameValue("Authorization", "Bearer {{access_token}}"));
		headers.add(new HeaderNameValue(CONTENT_TYPE_HEADER, ContentType.APPLICATION_JSON.getMimeType()));

		return new CreateDynamicSettlementMatrix(this.postJson(headers, matrix, "/matrices"));
	}

	public SettlementMatrix getMatrixById(String id) {
		List<HeaderNameValue> headers = new ArrayList<>();
		headers.add(new HeaderNameValue("X-Correlation-ID", UUID.randomUUID().toString()));
		headers.add(new HeaderNameValue("Authorization", "Bearer {{access_token}}"));
		headers.add(new HeaderNameValue(CONTENT_TYPE_HEADER, ContentType.APPLICATION_JSON.getMimeType()));
		return new SettlementMatrix(this.getJson(String.format("/matrices/%s", id), headers));
	}

	public BatchTransferSearchResults getTransfersByMatrixId(String id) {
		List<HeaderNameValue> headers = new ArrayList<>();
		headers.add(new HeaderNameValue("X-Correlation-ID", UUID.randomUUID().toString()));
		headers.add(new HeaderNameValue("Authorization", "Bearer {{access_token}}"));
		headers.add(new HeaderNameValue(CONTENT_TYPE_HEADER, ContentType.APPLICATION_JSON.getMimeType()));
		return new BatchTransferSearchResults(this.getJson(String.format("/transfers?matrixId=%s", id), headers));
	}

	public SettlementMatrix getMatrixByModel(
			String settlementModel,
			int timeBackInMinutes
	) {
		List<HeaderNameValue> headers = new ArrayList<>();
		headers.add(new HeaderNameValue("X-Correlation-ID", UUID.randomUUID().toString()));
		headers.add(new HeaderNameValue("Authorization", "Bearer {{access_token}}"));
		headers.add(new HeaderNameValue(CONTENT_TYPE_HEADER, ContentType.APPLICATION_JSON.getMimeType()));

		long endDate = System.currentTimeMillis();
		long startDate = (endDate - TimeUnit.MINUTES.toMillis(timeBackInMinutes));

		String url = String.format("/matrices?model=%s&startDate=%d&endDate=%d",
				settlementModel, startDate, endDate);
		return new SettlementMatrix(this.getJson(url, headers));
	}

	public AddRemoveBatchFromStaticMatrix addBatchToStaticMatrix(AddRemoveBatchFromStaticMatrix req) {
		List<HeaderNameValue> headers = new ArrayList<>();
		headers.add(new HeaderNameValue("X-Correlation-ID", UUID.randomUUID().toString()));
		headers.add(new HeaderNameValue("Authorization", "Bearer {{access_token}}"));
		headers.add(new HeaderNameValue(CONTENT_TYPE_HEADER, ContentType.APPLICATION_JSON.getMimeType()));

		return new AddRemoveBatchFromStaticMatrix(this.postJson(headers, req,
				String.format("/matrices/%s/batches", req.getMatrixId())));
	}

	public AddRemoveBatchFromStaticMatrix removeBatchFromStaticMatrix(AddRemoveBatchFromStaticMatrix req) {
		List<HeaderNameValue> headers = new ArrayList<>();
		headers.add(new HeaderNameValue("X-Correlation-ID", UUID.randomUUID().toString()));
		headers.add(new HeaderNameValue("Authorization", "Bearer {{access_token}}"));
		headers.add(new HeaderNameValue(CONTENT_TYPE_HEADER, ContentType.APPLICATION_JSON.getMimeType()));

		return new AddRemoveBatchFromStaticMatrix(this.deleteJson(
				headers, req, String.format("/matrices/%s/batches", req.getMatrixId())
		));
	}

	public SettlementMatrix actionMatrix(String matrixId, TestDataCarrier.ActionType actType) {
		List<HeaderNameValue> headers = new ArrayList<>();
		headers.add(new HeaderNameValue("X-Correlation-ID", UUID.randomUUID().toString()));
		headers.add(new HeaderNameValue("Authorization", "Bearer {{access_token}}"));
		headers.add(new HeaderNameValue(CONTENT_TYPE_HEADER, ContentType.APPLICATION_JSON.getMimeType()));

		SettlementMatrix sm = new SettlementMatrix(new JSONObject());
		sm.setId(matrixId);

		final String urlSuffix;
		switch (actType) {
			case matrix_recalculate: urlSuffix = "recalculate";break;
			case matrix_close: urlSuffix = "close";break;
			case matrix_settle: urlSuffix = "settle";break;
			case matrix_dispute: urlSuffix = "dispute";break;
			case matrix_lock: urlSuffix = "lock";break;
			case matrix_unlock: urlSuffix = "unlock";break;
			default:
				throw new IllegalStateException("Action on matrix '"+actType+"' not supported!");
		}

		new SettlementMatrix(this.postJson(headers, sm ,
				String.format("/matrices/%s/%s", matrixId, urlSuffix))
		);
		return sm;
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
