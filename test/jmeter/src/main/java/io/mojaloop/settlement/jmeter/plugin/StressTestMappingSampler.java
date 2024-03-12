package io.mojaloop.settlement.jmeter.plugin;

import io.mojaloop.settlement.jmeter.plugin.kafka.TxnProducer;
import io.mojaloop.settlement.jmeter.plugin.rest.client.SettlementBCRestClient;
import io.mojaloop.settlement.jmeter.plugin.rest.client.json.testdata.TestDataCarrier;
import io.mojaloop.settlement.jmeter.plugin.runner.SamplerRunner;
import io.mojaloop.settlement.jmeter.plugin.util.TestDataUtil;
import org.apache.jmeter.config.Arguments;
import org.apache.jmeter.protocol.java.sampler.AbstractJavaSamplerClient;
import org.apache.jmeter.protocol.java.sampler.JavaSamplerContext;
import org.apache.jmeter.samplers.SampleResult;
import org.apache.jmeter.util.JMeterUtils;
import org.slf4j.Logger;

import java.io.File;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.List;

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
		private static final String _1_INPUT_FILE = "inputFile";
		private static final String _2_URL = "url";
		private static final String _3_TOPIC = "topic";
		private static final String _4_URL_REST_API = "urlRestApi";
	}

	private Logger logger = this.getNewLogger();

	private String inputFile = null;
	private String url = "http://localhost:3001";//localhost:9092
	private String urlRestApi = "http://localhost:3600";
	private String topic = "";//SettlementsBcCommands

	private SettlementBCRestClient settleClient = null;
	private TxnProducer txnProducer = null;

	private int counter;
	private int commandCount;

	private List<TestDataCarrier> allTestData;

	@Override
	public void setupTest(JavaSamplerContext context) {
		super.setupTest(context);
		this.logger.info("Initiating test data. {}", JMeterUtils.getJMeterProperties());
		this.counter = 0;

		// Set Params:
		this.inputFile = context.getParameter(Arg._1_INPUT_FILE);

		File inputFileVal = new File(this.inputFile);
		this.allTestData = TestDataUtil.readTestDataFromFile(inputFileVal);
		if (this.allTestData.isEmpty()) {
			throw new IllegalStateException(
					String.format("No test data. Please provide '%s' parameter data and content.",
					Arg._1_INPUT_FILE)
			);
		}

		this.commandCount = this.allTestData.size();
		this.logger.info(String.format("Test file '%s' read a total of '%d' test scenarios.", this.inputFile, this.commandCount));

		this.url = context.getParameter(Arg._2_URL, this.url);
		this.topic = context.getParameter(Arg._3_TOPIC, this.topic);
		this.urlRestApi = context.getParameter(Arg._4_URL_REST_API, this.urlRestApi);

		if (this.isRest()) {
			this.settleClient = new SettlementBCRestClient(this.url);
			this.logger.info("REST: Initiation of test data for [{}] COMPLETE.", this.url);
		} else {
			// SettlementsBcCommands
			this.txnProducer = new TxnProducer();
			this.txnProducer.init(this.url, this.topic);
			this.settleClient = new SettlementBCRestClient(this.urlRestApi);
			this.logger.info("Kafka: Initiation of test data for [{}:{}:{}] COMPLETE.",
					this.url, this.topic, this.urlRestApi);
		}
	}

	private boolean isRest() {
		return this.url.toLowerCase().trim().startsWith("http");
	}

	@Override
	public Arguments getDefaultParameters() {
		Arguments defaultParameters = new Arguments();
		String userHome = System.getProperty("user.home");
		defaultParameters.addArgument(Arg._1_INPUT_FILE, userHome);
		defaultParameters.addArgument(Arg._2_URL, this.url);
		defaultParameters.addArgument(Arg._3_TOPIC, this.topic);
		defaultParameters.addArgument(Arg._4_URL_REST_API, this.urlRestApi);
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

			if (this.isRest()) returnVal.setURL(new URL(this.url));

			returnVal.setDataType(SampleResult.TEXT);
			returnVal.setContentType("application/json");

			// the execution utility...
			SamplerRunner sr = new SamplerRunner(this.logger, this.settleClient, this.txnProducer);
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
		if (this.txnProducer != null) this.txnProducer.destroy();
	}
}
