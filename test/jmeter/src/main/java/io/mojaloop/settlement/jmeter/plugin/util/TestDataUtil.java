package io.mojaloop.settlement.jmeter.plugin.util;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.batch.SettlementBatch;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.matrix.SettlementMatrix;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.testdata.TestDataCarrier;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.testdata.TestPlanConfig;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferReq;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.*;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

public class TestDataUtil {


	public static List<TestDataCarrier> readRawTestDataFromFile(File testData) {
		if (testData == null) return new ArrayList<>();
		if (!testData.exists()) return new ArrayList<>();

		File[] jsonFiles = testData.listFiles(new FilenameFilter() {
			@Override
			public boolean accept(File dir, String name) {
				return name.toLowerCase().endsWith(".json");
			}
		});
		if (jsonFiles == null || jsonFiles.length == 0) return new ArrayList<>();

		List<String> returnVal = new ArrayList<>();
		for (File jsonFile : jsonFiles) {
			try (BufferedReader br = new BufferedReader(new FileReader(jsonFile))) {
				String line;
				StringBuffer content = new StringBuffer();
				while ((line = br.readLine()) != null) {
					content.append(line);
					content.append("\n");
				}
				returnVal.add(content.toString());
			} catch (IOException ioErr) {
				throw new IllegalStateException(String.format(
						"Unable to read from '%s'. %s.",
						testData.getAbsolutePath(), ioErr.getMessage()), ioErr);
			}
		}

		return returnVal.stream().map(itm -> {
			TestDataCarrier returnValTDC = new TestDataCarrier(new JSONObject());
			returnValTDC.setRequestRaw(itm);
			returnValTDC.setActionType(TestDataCarrier.ActionType.transfer_raw);
			return returnValTDC;
		}).collect(Collectors.toList());
	}

	public static List<TestDataCarrier> readTestDataFromFile(File testData) {
		if (testData == null) return new ArrayList<>();
		if (!testData.exists()) return new ArrayList<>();

		List<TestDataCarrier> returnVal = new ArrayList<>();

		try (BufferedReader br = new BufferedReader(new FileReader(testData))) {
			String line;
			StringBuilder content = new StringBuilder();
			while ((line = br.readLine()) != null) {
				content.append(line);
				content.append("\n");
			}
			JSONArray array = new JSONArray(content.toString());
			for (int index = 0; index < array.length(); index++) {
				TestDataCarrier toAdd = new TestDataCarrier(array.getJSONObject(index));
				returnVal.add(toAdd);
			}
		} catch (IOException ioErr) {
			throw new IllegalStateException(String.format(
					"Unable to read from '%s'. %s.",
					testData.getAbsolutePath(), ioErr.getMessage()), ioErr);
		}
		return returnVal;
	}

	public static List<TestDataCarrier> filterForType(
		List<TestDataCarrier> source,
		TestDataCarrier.ActionType type
	) {
		return source.stream()
				.filter(itm -> itm.getActionType() == type)
				.collect(Collectors.toList());
	}

	public static TestPlanConfig readTestPlanConfig(File configFile) {
		if (!configFile.exists()) throw new IllegalStateException(String.format("Config '%s' does not exist.", configFile.getAbsolutePath()));

		StringBuffer buffer = new StringBuffer();
		try (FileReader fr = new FileReader(configFile)) {
			int read = -1;
			while ((read = fr.read()) != -1) buffer.append((char)read);
		} catch (IOException ioErr) {
			throw new IllegalStateException(String.format(
					"Unable to read from '%s'. %s.",
					configFile.getAbsolutePath(), ioErr.getMessage()), ioErr);
		}
		String data = buffer.toString();
		return new TestPlanConfig(new JSONObject(data));
	}

	public static void generateTestData(File testPlanConfigPath, File outputFile) {
		TestDataUtil.generateTestData(readTestPlanConfig(testPlanConfigPath), outputFile);
	}

	public static void generateTestData(TestPlanConfig testPlanConfig, File outputFile) {
		try (FileWriter fw = new FileWriter(outputFile, false)) {
			List<TestDataCarrier> testData = TestDataUtil.genTestDataFrom(testPlanConfig);
			JSONArray array = new JSONArray();
			testData.forEach(tdItm -> array.put(tdItm.toJsonObject()));
			String content = array.toString(2);
			try {
				fw.write(content);
			} catch (IOException eParam) {
				throw new IllegalStateException(String.format("Unable to write '%s' ", content));
			}
			fw.flush();
		} catch (IOException ioErr) {
			throw new IllegalStateException(String.format(
					"Unable to write to '%s'. %s.",
					outputFile.getAbsolutePath(), ioErr.getMessage()), ioErr);
		}
	}

	private static List<TestDataCarrier> genTestDataFrom(TestPlanConfig tpc) {
		List<TestDataCarrier> returnVal = new ArrayList<>();
		// Validate before
		tpc.validate();

		TestDataUtil.genSettlementTransferAndOtherData(returnVal, tpc);

		return returnVal;
	}

	private static void genSettlementTransferAndOtherData(
			List<TestDataCarrier> carriers,
			TestPlanConfig tpc
	) {
		TestPlanConfig.SettlementTransfer settleTransfer = tpc.getSettlementTransfer();

		for (int index = 0; index < settleTransfer.getCount(); index++) {
			TestDataCarrier toAdd = new TestDataCarrier(new JSONObject());
			toAdd.setActionType(TestDataCarrier.ActionType.transfer);

			int currencyIndex = randomNumberBetween(0, settleTransfer.getCurrencies().size() - 1);
			String currency = settleTransfer.getCurrencies().get(currencyIndex);
			int amount = randomNumberBetween(
					settleTransfer.getAmountMin(),
					settleTransfer.getAmountMax()
			);

			int payerIndex = randomNumberBetween(0, settleTransfer.getParticipants().size() - 1);
			int payeeIndex;
			do {
				payeeIndex = randomNumberBetween(0, settleTransfer.getParticipants().size() - 1);
			} while (payerIndex == payeeIndex);
			String payee = settleTransfer.getParticipants().get(payeeIndex);
			String payer = settleTransfer.getParticipants().get(payerIndex);
			String settlementModel = settleTransfer.getSettlementModels().get(
					randomNumberBetween(0, settleTransfer.getSettlementModels().size() - 1)
			);

			TransferReq settleTransferToAdd = new TransferReq(new JSONObject());
			settleTransferToAdd.setTransferId(uuidNoDash());
			settleTransferToAdd.setPayerFspId(payer);
			settleTransferToAdd.setPayeeFspId(payee);
			settleTransferToAdd.setCurrencyCode(currency);
			settleTransferToAdd.setAmount(Integer.toString(amount));
			settleTransferToAdd.setTimestamp(new Date());
			settleTransferToAdd.setSettlementModel(settlementModel);

			// first add the settlement transfer:
			toAdd.setRequest(settleTransferToAdd);
			carriers.add(toAdd);

			addInBetweenCalls(tpc, carriers, index, settlementModel);
		}
	}

	private static void addInBetweenCalls(
			TestPlanConfig tpc,
			List<TestDataCarrier> carriers,
			int index,
			String settlementModel
	) {
		TestPlanConfig.SettlementTransfer settleTransfer = tpc.getSettlementTransfer();
		TestPlanConfig.SettlementMatrix matrix = tpc.getSettlementMatrix();
		TestPlanConfig.SettlementBatch batch = tpc.getSettlementBatch();

		int getTxnBatchId = settleTransfer.getGetByBatchId();
		int getTxnMatrixId = settleTransfer.getGetByBatchId();
		int getBatchesByModel = batch.getGetByModel();
		int cntStatic = matrix.getCreateStatic();
		int cntStaticAdd = matrix.getAddBatchToStatic();
		int cntStaticRemove = matrix.getRemoveBatchFromStatic();
		int cntGetStatic = matrix.getGetStatic();
		int cntDynamicModel = matrix.getCreateDynamicModel();
		int cntGetDynamicModel = matrix.getGetDynamicModel();
		int cntStlClose = matrix.getClose();
		int cntStlLock = matrix.getLock();
		int cntStlSettle = matrix.getSettle();
		int cntStlRecalc = matrix.getSettle();

		// Batches By Model:
		if (isApplicable(index, getBatchesByModel)) {
			genBatchByModel(carriers, settlementModel);
		}

		// Transfers Get By Matrix:
		if (isApplicable(index, getTxnMatrixId)) {
			genTxnByMatrix(carriers);
		}

		// Static:
		if (isApplicable(index, cntStatic)) {
			genCreateStaticMatrix(carriers);
		}

		// Static - Add Batch:
		if (isApplicable(index, cntStaticAdd)) {
			genAddBatchToStaticMatrix(carriers);
		}

		// Static - Remove Batch:
		if (isApplicable(index, cntStaticRemove)) {
			genRemoveBatchFromStaticMatrix(carriers);
		}

		// Static - Get:
		if (isApplicable(index, cntGetStatic)) {
			genGetStaticMatrix(carriers);
		}

		// Dynamic - Model:
		if (isApplicable(index, cntDynamicModel)) {
			genCreateDynamicMatrixModel(carriers, settlementModel);
		}

		// Dynamic - Get by Model:
		if (isApplicable(index, cntGetDynamicModel)) {
			genGetDynamicMatrixModel(carriers, settlementModel);
		}

		// Settlement Matrix - Close:
		if (isApplicable(index, cntStlClose)) {
			genSettlementMatrixAction(carriers, TestDataCarrier.ActionType.matrix_close);
		}

		// Settlement Matrix - Lock:
		if (isApplicable(index, cntStlLock)) {
			genSettlementMatrixAction(carriers, TestDataCarrier.ActionType.matrix_lock);
		}

		// Settlement Matrix - Settle:
		if (isApplicable(index, cntStlSettle)) {
			genSettlementMatrixAction(carriers, TestDataCarrier.ActionType.matrix_settle);
		}
	}

	private static void genTxnByMatrix(List<TestDataCarrier> carriers) {
		TestDataCarrier toAdd = new TestDataCarrier(new JSONObject());
		toAdd.setActionType(TestDataCarrier.ActionType.transfers_by_matrix_id);
		TransferReq settleTransferToAdd = new TransferReq(new JSONObject());
		toAdd.setRequest(settleTransferToAdd);
		carriers.add(toAdd);
	}

	private static void genBatchByModel(List<TestDataCarrier> carriers, String model) {
		TestDataCarrier toAdd = new TestDataCarrier(new JSONObject());
		toAdd.setActionType(TestDataCarrier.ActionType.get_batches_by_model);
		SettlementBatch batchToAdd = new SettlementBatch(new JSONObject());
		batchToAdd.setSettlementModel(model);
		toAdd.setRequest(batchToAdd);
		carriers.add(toAdd);
	}

	private static void genCreateStaticMatrix(List<TestDataCarrier> carriers) {
		TestDataCarrier toAdd = new TestDataCarrier(new JSONObject());
		toAdd.setActionType(TestDataCarrier.ActionType.create_static_matrix);
		SettlementMatrix matrixToAdd = new SettlementMatrix(new JSONObject());
		matrixToAdd.setType(SettlementMatrix.Type.STATIC);
		toAdd.setRequest(matrixToAdd);
		carriers.add(toAdd);
	}

	private static void genGetStaticMatrix(List<TestDataCarrier> carriers) {
		TestDataCarrier toAdd = new TestDataCarrier(new JSONObject());
		toAdd.setActionType(TestDataCarrier.ActionType.get_static_matrix);
		SettlementMatrix matrixToAdd = new SettlementMatrix(new JSONObject());
		toAdd.setRequest(matrixToAdd);
		carriers.add(toAdd);
	}

	private static void genCreateDynamicMatrixModel(List<TestDataCarrier> carriers, String model) {
		TestDataCarrier toAdd = new TestDataCarrier(new JSONObject());
		toAdd.setActionType(TestDataCarrier.ActionType.create_dynamic_matrix_model);
		SettlementMatrix matrixToAdd = new SettlementMatrix(new JSONObject());
		matrixToAdd.setType(SettlementMatrix.Type.DYNAMIC);
		matrixToAdd.setSettlementModel(model);
		toAdd.setRequest(matrixToAdd);
		carriers.add(toAdd);
	}

	private static void genGetDynamicMatrixModel(List<TestDataCarrier> carriers, String model) {
		TestDataCarrier toAdd = new TestDataCarrier(new JSONObject());
		toAdd.setActionType(TestDataCarrier.ActionType.get_dynamic_matrix_model);
		SettlementMatrix matrixToAdd = new SettlementMatrix(new JSONObject());
		matrixToAdd.setType(SettlementMatrix.Type.DYNAMIC);
		matrixToAdd.setSettlementModel(model);
		toAdd.setRequest(matrixToAdd);
		carriers.add(toAdd);
	}

	private static void genSettlementMatrixAction(
			List<TestDataCarrier> carriers,
			TestDataCarrier.ActionType actType
	) {
		TestDataCarrier toAdd = new TestDataCarrier(new JSONObject());
		toAdd.setActionType(actType);
		SettlementMatrix matrixToAdd = new SettlementMatrix(new JSONObject());
		toAdd.setRequest(matrixToAdd);
		carriers.add(toAdd);
	}

	private static void genAddBatchToStaticMatrix(List<TestDataCarrier> carriers) {
		TestDataCarrier toAdd = new TestDataCarrier(new JSONObject());
		toAdd.setActionType(TestDataCarrier.ActionType.add_batch_to_static_matrix);
		SettlementBatch batchToAdd = new SettlementBatch(new JSONObject());
		toAdd.setRequest(batchToAdd);
		carriers.add(toAdd);
	}

	private static void genRemoveBatchFromStaticMatrix(List<TestDataCarrier> carriers) {
		TestDataCarrier toAdd = new TestDataCarrier(new JSONObject());
		toAdd.setActionType(TestDataCarrier.ActionType.remove_batch_from_static_matrix);
		SettlementBatch batchToAdd = new SettlementBatch(new JSONObject());
		toAdd.setRequest(batchToAdd);
		carriers.add(toAdd);
	}

	private static boolean isApplicable(int index, int count) {
		if (count < 1) return false;
		if (index < count) return false;
		return ((index % count) == 0);
	}

	private static int calculatePercentage(double amount, double fee) {
		return (int)(fee * 100 / amount);
	}

	private static int randomNumberBetween(int min, int max) {
		if (min == 0 && max == 0) return 0;
		return ThreadLocalRandom.current().nextInt(min, max + 1);
	}

	private static String uuidNoDash() {
		return UUID.randomUUID().toString().replace("\\-", "");
	}

	private static String minorToDecimalFormatted(int minorAmount) {
		return new BigDecimal(minorAmount).movePointRight(0).toString();
	}
}
