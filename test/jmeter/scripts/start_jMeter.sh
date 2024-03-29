#!/usr/bin/env bash
# Setup the following variables for your local environment:
export JMETER_HOME="/home/ec2-user/mjl_settlement_performance/apache-jmeter-5.6.3"
#export JMETER_HOME="/opt/homebrew/Cellar/jmeter/5.6.3"
export HEAP="-Xms3g -Xmx6g -XX:MaxMetaspaceSize=2024m"
#export JMETER_LIB_PATH="$JMETER_HOME/libexec/lib/ext"
export JMETER_LIB_PATH="$JMETER_HOME/lib/ext"
# Optional:
export JAVA_HOME=/home/ec2-user/.sdkman/candidates/java/8.0.402-amzn
#export JAVA_HOME=/Users/jasonbruwer/Library/Java/JavaVirtualMachines/corretto-1.8.0_382/Contents/Home

# First build to get the latest:
mvn clean
mvn clean install -U
mvn clean install assembly:single

# Copy the jar over:
cp target/settlement-bc-jmeter-jar-with-dependencies.jar $JMETER_LIB_PATH

# Clear logs:
rm jmeter.log
rm jMeterResults.log

# Default to GUI mode
if [ "$1" == "console" ]; then
    $JMETER_HOME/bin/jmeter -n -t test-plan/JMeter-MJLSettlementsBC-Default.jmx -l jMeterResults.log -e -o jMeterOut
else
    $JMETER_HOME/bin/jmeter -t ./test-plan/JMeter-MJLSettlementsBC-Default.jmx
fi
