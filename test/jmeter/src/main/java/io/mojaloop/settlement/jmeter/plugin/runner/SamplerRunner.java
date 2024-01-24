package io.mojaloop.settlement.jmeter.plugin.runner;

import io.mojaloop.settlement.jmeter.plugin.exception.FailedResponseCodeException;
import io.mojaloop.settlement.jmeter.plugin.kafka.TxnProducer;
import io.mojaloop.settlement.jmeter.plugin.rest.client.RESTClientException;
import io.mojaloop.settlement.jmeter.plugin.rest.client.SettlementBCRestClient;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.testdata.TestDataCarrier;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferReq;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferRsp;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.ToString;
import org.apache.jmeter.samplers.SampleResult;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.json.JSONObject;
import org.slf4j.Logger;

import java.net.HttpURLConnection;
import java.util.Date;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Utility class used to run each of the test data types.
 */
@RequiredArgsConstructor
public class SamplerRunner {
	private static final int QUEUE_MAX = 5000000;

	private static Queue<FundTransfer> validFundtransfer = new ConcurrentLinkedQueue<>();

	private final Logger logger;
	private final SettlementBCRestClient settleClient;
	private final TxnProducer txnProducer;

	@RequiredArgsConstructor
	@Getter
	@ToString
	private static class FundTransfer {
		private final long addedAt;
		private final String requestId;
	}

	public void execute(
		TestDataCarrier testData,
		SampleResult result,
		int testDataIndex
	) {
		String contentToSend = "{}";
		if (testData.getRequest() != null) contentToSend = testData.getRequest().toJsonObject().toString();

		String responseData = "Unknown";
		try {
			JSONObject responseJSON = null;
			TestDataCarrier.ActionType actionType = testData.getActionType();
			switch (actionType) {
				case transfer:
					TransferReq fundTransfer = (TransferReq) testData.getRequest();
					fundTransfer.setTransferId(UUID.randomUUID().toString());
					fundTransfer.setTimestamp(new Date(System.currentTimeMillis()));

					contentToSend = fundTransfer.toJsonObject().toString();
					result.setRequestHeaders(this.createHeaderVal(actionType, "/transfers", testDataIndex));
					this.validateAndCorrectTransfer(fundTransfer);
					result.sampleStart();

					if (this.txnProducer == null) {
						TransferRsp fundTransferRsp = this.settleClient.settlementTransfer(fundTransfer);
						result.sampleEnd();
						responseJSON = fundTransferRsp.toJsonObject();
						if (!fundTransferRsp.isSuccess()) throw new FailedResponseCodeException("401", responseJSON);
					} else {
						RecordMetadata metadata = this.txnProducer.send(fundTransfer);
						result.sampleEnd();
						responseJSON = new JSONObject();
						responseJSON.put("timestamp", metadata.timestamp());
						responseJSON.put("topic", metadata.topic());
					}
					/*
					long timestamp = System.currentTimeMillis();
					this.addValidFundTransfer(new FundTransfer(
							timestamp,
							fundTransfer.getTransferId()
					));*/
				break;
				case transfer_raw:
					result.setRequestHeaders(this.createHeaderVal(actionType, "/fundtransfer", testDataIndex));
					contentToSend = testData.getRequestRaw();

					result.sampleStart();
					responseJSON = this.settleClient.settlementTransferRaw(contentToSend);
					result.sampleEnd();
					TransferRsp fundTransferRspRaw = new TransferRsp(responseJSON);

					if (!fundTransferRspRaw.isSuccess()) {
						throw new FailedResponseCodeException("401", responseJSON);
					}
				break;
				default:
					throw new IllegalStateException(String.format("Action type '%s' not yet supported.", testData.getActionType()));
			}

			result.setResponseMessage(String.format("SUCCESS"));
			testData.setResponse(responseJSON);

			if (responseJSON != null) responseData = responseJSON.toString();
			result.setResponseData(responseData, "UTF-8");

			result.setSuccessful(Boolean.TRUE);
			result.setResponseCode(Integer.toString(HttpURLConnection.HTTP_OK));
			result.setResponseCodeOK();
		} catch (FailedResponseCodeException except) {
			result.setSuccessful(Boolean.FALSE);
			if (except.getJsonObject() != null) responseData = except.getJsonObject().toString();
			result.setResponseData(responseData, "UTF-8");
			result.setResponseCode(Integer.toString(HttpURLConnection.HTTP_OK));
			result.setResponseCodeOK();

			String samplerLabel = result.getSampleLabel();
			result.setSampleLabel(String.format("%s:%s", samplerLabel, except.getRspCode()));
		} catch (Exception except) {
			logger.error(except.getMessage(), except);
			result.sampleEnd();
			String errMsg = except.getMessage();
			if (errMsg == null) errMsg = "[Msg not set for error.]";

			result.setSuccessful(Boolean.FALSE);
			result.setResponseData(errMsg, "UTF-8");
			result.setResponseMessage("ERROR-EXCEPTION ("+ testData.getActionType()+"): "+ errMsg);
			result.setResponseCode("500");
			if (except instanceof RESTClientException) {
				RESTClientException casted = (RESTClientException)except;
				result.setResponseCode(String.format("%s-%d", result.getResponseCode(), casted.getErrorCode()));
			}
		} finally {
			long bodySize = contentToSend == null ? 0L : (long)contentToSend.getBytes().length;
			result.setBodySize(bodySize);
			result.setSamplerData(contentToSend);
		}
	}

	private String createHeaderVal(
			TestDataCarrier.ActionType actionType,
			String urlPostfix,
			int dataRowIndex
	) {
		return String.format("Action-Type: %s\nURL: %s\nTest Data Index: %d",
				actionType, urlPostfix, dataRowIndex);
	}

	private void addValidFundTransfer(FundTransfer fundTransfer) {
		if (validFundtransfer.size() > QUEUE_MAX) return;
		validFundtransfer.add(fundTransfer);
	}

	private void validateAndCorrectTransfer(TransferReq fundTransfer) {
		//TODO need to validate here
	}

	public static void clearQueues() {
		validFundtransfer.clear();
	}
}
