#!/usr/bin/env bash
# Setup the following variables for your local environment:
export JMETER_HOME="/opt/homebrew/Cellar/jmeter/5.6.2"
export HEAP="-Xms3g -Xmx6g -XX:MaxMetaspaceSize=2024m"
export JMETER_LIB_PATH="$JMETER_HOME/libexec/lib"
# Optional:
export JAVA_HOME=/Users/jasonbruwer/Library/Java/JavaVirtualMachines/corretto-1.8.0_382/Contents/Home

# First build to get the latest:
mvn clean
mvn clean install -U
mvn clean install assembly:single

# Copy the jar over:
cp target/aptraws-jmeter-jar-with-dependencies.jar $JMETER_LIB_PATH

# Clear logs:
rm jmeter.log
rm jMeterResults.log

# Default to GUI mode
if [ "$1" == "console" ]; then
    $JMETER_HOME/bin/jmeter -n -t test-plan/JMeter-MJLSettlementsBC-Default.jmx -l jMeterResults.log -e -o jMeterOut
else
    $JMETER_HOME/bin/jmeter -t test-plan/JMeter-MJLSettlementsBC-Default.jmx
fi
