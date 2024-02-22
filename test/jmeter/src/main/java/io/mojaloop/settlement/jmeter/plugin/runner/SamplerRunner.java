package io.mojaloop.settlement.jmeter.plugin.runner;

import io.mojaloop.settlement.jmeter.plugin.exception.FailedResponseCodeException;
import io.mojaloop.settlement.jmeter.plugin.kafka.TxnProducer;
import io.mojaloop.settlement.jmeter.plugin.rest.client.RESTClientException;
import io.mojaloop.settlement.jmeter.plugin.rest.client.SettlementBCRestClient;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.batch.BatchSearchResults;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.batch.SettlementBatch;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix.AddRemoveBatchFromStaticMatrix;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix.CreateDynamicSettlementMatrix;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix.CreateStaticSettlementMatrix;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix.SettlementMatrix;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.testdata.TestDataCarrier;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.BatchTransferSearchResults;
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
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Utility class used to run each of the test data types.
 */
@RequiredArgsConstructor
public class SamplerRunner {
	private static final int QUEUE_MAX = 5000000;

	private static final Queue<FundTransfer> validFundtransfer = new ConcurrentLinkedQueue<>();
	private static final Queue<SettlementBatch> validBatches = new ConcurrentLinkedQueue<>();
	private static final Queue<CreateStaticSettlementMatrix> staticMatrices = new ConcurrentLinkedQueue<>();
	private static final Queue<CreateDynamicSettlementMatrix> dynamicMatrices = new ConcurrentLinkedQueue<>();
	private static final Queue<AddRemoveBatchFromStaticMatrix> batchesAdded = new ConcurrentLinkedQueue<>();
	private static final Queue<SettlementMatrix> matrixClosed = new ConcurrentLinkedQueue<>();
	private static final Queue<SettlementMatrix> matrixLocked = new ConcurrentLinkedQueue<>();

	private final Logger logger;
	private final SettlementBCRestClient settleClient;
	private final TxnProducer txnProducer;
	public static final int TIME_BACK_MIN = 20;

	@RequiredArgsConstructor
	@Getter
	@ToString
	private static class FundTransfer {
		private final long addedAt;
		private final String requestId;
	}

	public void execute(TestDataCarrier testData, SampleResult result, int testDataIndex) {
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
				break;
				case transfers_by_matrix_id:
					String matrixId = null;
					CreateStaticSettlementMatrix existingStaticTxnFetch = staticMatrices.poll();
					if (existingStaticTxnFetch != null) {
						matrixId = existingStaticTxnFetch.getMatrixId();
						staticMatrices.add(existingStaticTxnFetch);
					}
					CreateDynamicSettlementMatrix existingDynamic = dynamicMatrices.poll();
					if (existingDynamic != null) {
						matrixId = existingDynamic.getMatrixId();
						dynamicMatrices.add(existingDynamic);
					}
					if (matrixId == null) throw new IllegalStateException("No matrix available to fetch from");

					result.setRequestHeaders(this.createHeaderVal(actionType, "/transfers_by_matrix_id", testDataIndex));
					contentToSend = matrixId;

					result.sampleStart();
					BatchTransferSearchResults txnLookupRsp = this.settleClient.getTransfersByMatrixId(matrixId);
					result.sampleEnd();
					responseJSON = txnLookupRsp.toJsonObject();
				break;
				case get_batches_by_model:
					SettlementBatch getBatchReq = (SettlementBatch) testData.getRequest();
					contentToSend = getBatchReq.toJsonObject().toString();
					result.setRequestHeaders(this.createHeaderVal(actionType, "/batches", testDataIndex));

					result.sampleStart();
					BatchSearchResults batchSrRsp = this.settleClient.settlementBatches(
							getBatchReq.getSettlementModel(),
							TIME_BACK_MIN
					);
					result.sampleEnd();
					responseJSON = batchSrRsp.toJsonObject();

					synchronized (validBatches) {
						validBatches.addAll(batchSrRsp.getItems());
					}
				break;
				case create_static_matrix:
					CreateStaticSettlementMatrix staticMatrix = new CreateStaticSettlementMatrix(new JSONObject());
					staticMatrix.setType(SettlementMatrix.Type.STATIC);
					staticMatrix.setMatrixId(UUID.randomUUID().toString());
					contentToSend = staticMatrix.toJsonObject().toString();
					result.setRequestHeaders(this.createHeaderVal(actionType, "/create_static_matrix", testDataIndex));

					result.sampleStart();
					CreateStaticSettlementMatrix staticCreateRsp = this.settleClient.createMatrix(staticMatrix);
					result.sampleEnd();
					responseJSON = staticCreateRsp.toJsonObject();

					synchronized (staticMatrices) {
						staticMatrices.add(staticMatrix);
					}
				break;
				case get_static_matrix:
					CreateStaticSettlementMatrix existingStatic = staticMatrices.poll();
					if (existingStatic == null) throw new IllegalStateException("No static matrices available");

					contentToSend = existingStatic.toJsonObject().toString();
					result.setRequestHeaders(this.createHeaderVal(actionType, "/get_static_matrix", testDataIndex));

					result.sampleStart();
					SettlementMatrix staticByIdRsp = this.settleClient.getMatrixById(existingStatic.getMatrixId());
					result.sampleEnd();
					responseJSON = staticByIdRsp.toJsonObject();
				break;
				case create_dynamic_matrix_model:
					SettlementMatrix settlementMatrix = (SettlementMatrix) testData.getRequest();
					CreateDynamicSettlementMatrix dynamicMatrix = new CreateDynamicSettlementMatrix(new JSONObject());
					dynamicMatrix.setType(SettlementMatrix.Type.DYNAMIC);
					dynamicMatrix.setMatrixId(UUID.randomUUID().toString());
					dynamicMatrix.setSettlementModel(settlementMatrix.getSettlementModel());
					contentToSend = dynamicMatrix.toJsonObject().toString();
					result.setRequestHeaders(this.createHeaderVal(actionType, "/create_dynamic_matrix_model", testDataIndex));

					result.sampleStart();
					CreateDynamicSettlementMatrix dynamicModelCreateRsp = this.settleClient.createMatrix(dynamicMatrix);
					result.sampleEnd();
					responseJSON = dynamicModelCreateRsp.toJsonObject();

					synchronized (dynamicMatrices) {
						dynamicMatrices.add(dynamicMatrix);
					}
				break;
				case get_dynamic_matrix_model:
					SettlementMatrix matrixForGetDyn = (SettlementMatrix) testData.getRequest();
					contentToSend = matrixForGetDyn.toJsonObject().toString();
					result.setRequestHeaders(this.createHeaderVal(actionType, "/get_dynamic_matrix_model", testDataIndex));

					result.sampleStart();
					SettlementMatrix dynamicByModelRsp = this.settleClient.getMatrixByModel(
							matrixForGetDyn.getSettlementModel(),
							TIME_BACK_MIN
					);
					result.sampleEnd();
					responseJSON = dynamicByModelRsp.toJsonObject();
				break;
				case add_batch_to_static_matrix:
					SettlementBatch existingBatch = validBatches.poll();
					if (existingBatch == null) throw new IllegalStateException("No valid batches available to add");
					CreateStaticSettlementMatrix existingMatrixStat = staticMatrices.poll();
					if (existingMatrixStat == null) throw new IllegalStateException("No existing static matrix to add batch to");

					result.setRequestHeaders(this.createHeaderVal(actionType, "/add_batch_to_static_matrix", testDataIndex));

					AddRemoveBatchFromStaticMatrix addBatch = new AddRemoveBatchFromStaticMatrix(new JSONObject());
					addBatch.setMatrixId(existingMatrixStat.getMatrixId());
					List<String> batchToAdd = new ArrayList<>();
					batchToAdd.add(existingBatch.getBatchUUID());
					addBatch.setBatchIds(batchToAdd);

					contentToSend = addBatch.toJsonObject().toString();

					result.sampleStart();
					AddRemoveBatchFromStaticMatrix addedRsp = this.settleClient.addBatchToStaticMatrix(addBatch);
					result.sampleEnd();
					responseJSON = addedRsp.toJsonObject();
					synchronized (batchesAdded) {
						batchesAdded.add(addBatch);
					}
				break;
				case remove_batch_from_static_matrix:
					AddRemoveBatchFromStaticMatrix addedBatch = batchesAdded.poll();
					if (addedBatch == null) throw new IllegalStateException("No batches added to remove from matrix");

					contentToSend = addedBatch.toJsonObject().toString();
					result.setRequestHeaders(this.createHeaderVal(actionType, "/remove_batch_from_static_matrix", testDataIndex));

					result.sampleStart();
					AddRemoveBatchFromStaticMatrix removedRsp = this.settleClient.removeBatchFromStaticMatrix(addedBatch);
					result.sampleEnd();
					responseJSON = removedRsp.toJsonObject();
				break;
				case matrix_recalculate:
				case matrix_close:
				case matrix_lock:
				case matrix_settle:
					SettlementMatrix matrixPerReq = null;
					if (actionType == TestDataCarrier.ActionType.matrix_lock) {
						matrixPerReq = matrixClosed.poll();
					} else if (actionType == TestDataCarrier.ActionType.matrix_settle) {
						matrixPerReq = matrixLocked.poll();
					} else {
						CreateDynamicSettlementMatrix dynMat = dynamicMatrices.poll();
						if (dynMat != null) {
							matrixPerReq = new SettlementMatrix(new JSONObject());
							matrixPerReq.setId(dynMat.getMatrixId());
						}
					}
					if (matrixPerReq == null) throw new IllegalStateException("No dynamic matrix to '"+actionType+"'.");
					contentToSend = matrixPerReq.toJsonObject().toString();

					result.setRequestHeaders(this.createHeaderVal(actionType,
							String.format("/%s_dynamic_matrix", actionType), testDataIndex));

					result.sampleStart();
					SettlementMatrix actionRsp = this.settleClient.actionMatrix(
							matrixPerReq.getId(), actionType
					);
					result.sampleEnd();
					responseJSON = actionRsp.toJsonObject();
					if (actionType == TestDataCarrier.ActionType.matrix_lock) {
						matrixLocked.add(actionRsp);
					} else if (actionType == TestDataCarrier.ActionType.matrix_close) {
						matrixClosed.add(actionRsp);
					}
				break;
				case transfer_raw:
					result.setRequestHeaders(this.createHeaderVal(actionType, "/transfers_raw", testDataIndex));
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

			if (responseJSON != null) responseData = responseJSON.toString(2);
			result.setResponseData(responseData, "UTF-8");

			result.setSuccessful(Boolean.TRUE);
			result.setResponseCode(Integer.toString(HttpURLConnection.HTTP_OK));
			result.setResponseCodeOK();
		} catch (FailedResponseCodeException except) {
			result.setSuccessful(Boolean.FALSE);
			if (except.getJsonObject() != null) responseData = except.getJsonObject().toString(2);
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

	public static void clearQueues() {
		validFundtransfer.clear();
		validBatches.clear();
		staticMatrices.clear();
		dynamicMatrices.clear();
		batchesAdded.clear();
		matrixLocked.clear();
		matrixClosed.clear();
	}
}
