# Stress Testing for Settlements-BC using JMeter

## Install
The `AbstractJavaSamplerClient` for `MJL Settlements-BC` needs to be added to the jMeter.
Make use of the `scripts/start_jMeter.sh` script to install the bespoke sampler.

# Useful Links:
https://jmeter.apache.org/usermanual/get-started.html
https://jmeter.apache.org/usermanual/best-practices.html
https://jmeter.apache.org/usermanual/component_reference.html#listeners

## Configure
The following configuration possibilities exists for the MJL Settlements-BC JMeter stress testing.

### Default Test Plan for MJL Settlements-BC
jMeter requires a test plan configuration file whereby the number of threads/clients and a whole range of other 
properties may be configured. The configuration will also tell jMeter where the custom plug-in may be found.
Please see `./test-plan/JMeter-MJLSettlementsBC-Default.jmx`.
The MJL Settlements-BC test plan makes use of a custom sampler, the entrypoint of which is: 
`io.mojaloop.settlement.jmeter.StressTestMappingSampler`

### Generate Test Data based of Plan Configuration:
The following command will generate test data based on `ExecutionPlanConfig.json`. Modify the plan configuration to suit the test scenarios.

```shell
gen_test_data stresstesting/test-plan/ExecutionPlanConfig.json stresstesting/test-plan/InData.json
```

### Print the Test Data:
```shell
print_test_data stresstesting/test-plan/InData.json
```

## Run
In order to successfully run the stress test, the jMeter profile needs to be configured for your local environment. Please follow the steps below;
1. Update environment variables in `scripts/start_jMeter.sh`
2. We are now ready to configure jMeter, run the following command;
```shell
scripts/start_jMeter.sh
```

If you wish to execute jMeter in console mode only, execute the following command:
```shell
scripts/start_jMeter.sh console
```
The execution results may be found at `jMeterOut`.
