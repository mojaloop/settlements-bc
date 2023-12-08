package io.mojaloop.settlement.jmeter.main;

import io.mojaloop.settlement.jmeter.plugin.rest.client.json.testdata.TestDataCarrier;
import io.mojaloop.settlement.jmeter.plugin.util.TestDataUtil;

import java.io.File;
import java.util.List;

public class Main {
	public static void main(String[] args) {
		String operation = args.length > 0 ? args[0] : "none";
		switch (operation.toLowerCase()) {
			case "gen_test_data":
				if (args.length != 3) {
					printUsage();
					return;
				}
				File testPlanConfFile = new File(args[1]), outFile = new File(args[2]);
				TestDataUtil.generateTestData(testPlanConfFile, outFile);
				System.out.println("Success!");
			break;
			case "print_test_data":
				if (args.length != 2) {
					printUsage();
					return;
				}
				File testData = new File(args[1]);
				List<TestDataCarrier> testDataCarriers = TestDataUtil.readTestDataFromFile(testData);
				testDataCarriers.forEach(itm -> {
					switch (itm.getActionType()) {
						case transfer:
							System.out.println(itm.toJsonObject().toString(3));
							break;
						default:
							System.out.println(itm.toJsonObject().toString(1));
					}
				});
			break;
			default:
				printUsage();
		}
	}

	private static void printUsage() {
		System.out.println("Usage. Operation + params.");
	}
}
