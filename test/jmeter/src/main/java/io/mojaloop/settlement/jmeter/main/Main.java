package io.mojaloop.settlement.jmeter.main;

import io.mojaloop.settlement.jmeter.plugin.kafka.TxnProducer;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.testdata.TestDataCarrier;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.transfer.TransferReq;
import io.mojaloop.settlement.jmeter.plugin.util.TestDataUtil;
import org.json.JSONObject;

import java.io.File;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

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
			case "test_kafka":
				TxnProducer prod = new TxnProducer();
				//http://localhost:3600
				//localhost:9092
				prod.init("localhost:9092", "SettlementsBcCommands");
                try {
                    prod.send(testReq());
                } catch (ExecutionException eParam) {
                    throw new RuntimeException(eParam);
                } catch (InterruptedException eParam) {
                    throw new RuntimeException(eParam);
                } finally {
					prod.destroy();
				}
                break;
			default:
				printUsage();
		}
	}

	private static TransferReq testReq() {
		TransferReq returnVal = new TransferReq(new JSONObject());
		returnVal.setTimestamp(new Date());
		returnVal.setAmount("1200");
		returnVal.setSettlementModel("DEFAULT");
		returnVal.setCurrencyCode("USD");
		returnVal.setTransferId(UUID.randomUUID().toString());
		returnVal.setPayerFspId(UUID.randomUUID().toString());
		returnVal.setPayeeFspId(UUID.randomUUID().toString());

		return returnVal;
	}

	private static void printUsage() {
		System.out.println("Usage. Operation + params.");
	}
}
