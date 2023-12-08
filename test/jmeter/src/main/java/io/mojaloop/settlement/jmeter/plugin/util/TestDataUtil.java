package io.mojaloop.settlement.jmeter.plugin.util;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.testdata.TestDataCarrier;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.testdata.TestPlanConfig;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferReq;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.*;
import java.math.BigDecimal;
import java.util.*;
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
			StringBuffer content = new StringBuffer();
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
		TestPlanConfig.SettlementTransfer settlementTransfer = tpc.getSettlementTransfer();
		for (int index = 0; index < settlementTransfer.getCount(); index++) {
			TestDataCarrier toAdd = new TestDataCarrier(new JSONObject());
			toAdd.setActionType(TestDataCarrier.ActionType.transfer);

			int currencyIndex = randomNumberBetween(
					0,
					tpc.getSettlementTransfer().getCurrencies().size() - 1
			);
			String currency = tpc.getSettlementTransfer().getCurrencies().get(currencyIndex);
			int amount = randomNumberBetween(
					tpc.getSettlementTransfer().getAmountMin(),
					tpc.getSettlementTransfer().getAmountMax()
			);
			// TODO TestPlanConfig.Bank bankPayer = tpc.getBanks().get(randomNumberBetween(0, tpc.getBanks().size() - 1));
			TransferReq fundTransfer = new TransferReq(new JSONObject());
			fundTransfer.setRequestId(uuidNoDash());
			fundTransfer.setTimestamp(new Date());

			toAdd.setRequest(fundTransfer);
			returnVal.add(toAdd);
		}
		return returnVal;
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
