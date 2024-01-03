package io.mojaloop.settlement.jmeter.plugin;

import io.mojaloop.settlement.jmeter.plugin.rest.client.SettlementBCClient;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.testdata.TestDataCarrier;
import io.mojaloop.settlement.jmeter.plugin.runner.SamplerRunner;
import io.mojaloop.settlement.jmeter.plugin.util.TestDataUtil;
import org.apache.jmeter.config.Arguments;
import org.apache.jmeter.protocol.java.sampler.AbstractJavaSamplerClient;
import org.apache.jmeter.protocol.java.sampler.JavaSamplerContext;
import org.apache.jmeter.samplers.SampleResult;
import org.slf4j.Logger;

import java.io.File;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Custom sampler for MJL Settlement-BC.
 * @see StressTestMappingSampler#runTest(JavaSamplerContext javaSamplerContext)
 *
 */
public class StressTestMappingSampler extends AbstractJavaSamplerClient {
	/**
	 * Arguments accepted by the sampler.
	 */
	private static class Arg {
		private static final String _0_INPUT_FILE = "inputFile";
		private static final String _2_URL = "url";
	}

	private Logger logger = this.getNewLogger();

	private String inputFile = null;
	private String url = "http://localhost:3001";

	private SettlementBCClient settleClient = null;

	private int counter;
	private int commandCount;

	private List<TestDataCarrier> allTestData;

	private Map<String, Object> validPrepare = new ConcurrentHashMap<>();

	@Override
	public void setupTest(JavaSamplerContext context) {
		super.setupTest(context);
		this.logger.info("Initiating test data. {}", JavaSamplerContext.getJMeterProperties());
		this.counter = 0;

		// Set Params:
		this.inputFile = context.getParameter(Arg._0_INPUT_FILE);

		File inputFileVal = new File(this.inputFile);
		this.allTestData = TestDataUtil.readTestDataFromFile(inputFileVal);
		if (this.allTestData.isEmpty()) {
			throw new IllegalStateException(
					String.format("No test data. Please provide '%s' parameter data and content.",
					Arg._0_INPUT_FILE)
			);
		}

		this.commandCount = this.allTestData.size();
		this.logger.info(String.format("Test file '%s' read a total of '%d' test scenarios.", this.inputFile, this.commandCount));

		this.url = context.getParameter(Arg._2_URL, this.url);
		this.settleClient = new SettlementBCClient(this.url);

		//Populate the form containers...
		this.logger.info("Initiation of test data for [{}] COMPLETE.", this.url);
	}

	@Override
	public Arguments getDefaultParameters() {
		Arguments defaultParameters = new Arguments();
		String userHome = System.getProperty("user.home");
		defaultParameters.addArgument(Arg._0_INPUT_FILE, userHome);
		defaultParameters.addArgument(Arg._2_URL, this.url);
		return defaultParameters;
	}

	@Override
	public SampleResult runTest(JavaSamplerContext javaSamplerContext) {
		SampleResult returnVal = new SampleResult();
		if (this.allTestData == null || this.allTestData.isEmpty()) return returnVal;

		TestDataCarrier testData = this.allTestData.get(this.counter);
		returnVal.setSentBytes(testData.toString().getBytes().length);

		String testDataType = testData.getActionType().name();
		try {
			returnVal.setSampleLabel(String.format("[%s]:[%s]", this.url, testDataType));
			returnVal.setURL(new URL(this.url));
			returnVal.setDataType(SampleResult.TEXT);
			returnVal.setContentType("application/json");

			// the execution utility...
			SamplerRunner sr = new SamplerRunner(this.logger, this.settleClient);
			sr.execute(testData, returnVal, this.counter + 1);
		} catch (MalformedURLException eParam) {
			throw new IllegalStateException(eParam.getMessage(), eParam);
		} finally {
			this.counter++;
			if (this.counter >= this.commandCount) this.counter = 0;
		}
		return returnVal;
	}

	@Override
	public void teardownTest(JavaSamplerContext context) {
		super.teardownTest(context);
		SamplerRunner.clearQueues();
	}
}
