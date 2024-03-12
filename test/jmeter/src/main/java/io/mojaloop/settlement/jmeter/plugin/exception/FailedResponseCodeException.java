package io.mojaloop.settlement.jmeter.plugin.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.json.JSONObject;

@RequiredArgsConstructor
@Getter
public class FailedResponseCodeException extends Exception {
    private final String rspCode;
    private final JSONObject jsonObject;
}
