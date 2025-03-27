/*****
License
--------------
Copyright © 2020-2025 Mojaloop Foundation
The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

Contributors
--------------
This is the official list of the Mojaloop project contributors for this file.
Names of the original copyright holders (individuals or organizations)
should be listed with a '*' in the first column. People who have
contributed from an organization can be listed under the organization
that actually holds the copyright for their contributions (see the
Mojaloop Foundation for an example). Those individuals should have
their names indented and be marked with a '-'. Email address can be added
optionally within square brackets <email>.

* Mojaloop Foundation
- Name Surname <name.surname@mojaloop.io>

* ILF
- Jason Bruwer <jason@interledger.org>
*****/

"use strict";

import {
    ConfigFeatureFlag,
    ConfigParameter,
    ConfigParameterTypes,
    ConfigSecret,
    ConfigurationSet,
    Currency,
    GLOBAL_FIXED_PARAMETERS_DEFINITION,
    IBaseConfigurationClient,
    IBoundedContextConfigurationClient,
    IGlobalConfigurationClient
} from "@mojaloop/platform-configuration-bc-public-types-lib";

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */

export class BaseConfigurationMockClient implements IBaseConfigurationClient{
    protected _schemaVersion: string;
    protected _iterationNumber: number;

    protected readonly _parameters: Map<string, ConfigParameter>;
    protected readonly _featureFlags: Map<string, ConfigFeatureFlag>;
    protected readonly _secrets: Map<string, ConfigSecret>;

    constructor(schemaVersion?:string) {
        this._iterationNumber = 0;
        if (schemaVersion) this._schemaVersion = schemaVersion;

        this._parameters = new Map<string, ConfigParameter>();
        this._featureFlags = new Map<string, ConfigFeatureFlag>();
        this._secrets = new Map<string, ConfigSecret>();
    }

    get schemaVersion(): string {
        return this._schemaVersion;
    }

    get iterationNumber(): number {
        return this._iterationNumber;
    }

    has(name: string): boolean {
        let found = false;
        const upperCaseName = name.toUpperCase();

        for (const key of this._parameters.keys()) {
            if (key.toUpperCase()===upperCaseName) found = true;
        }
        for (const key of this._featureFlags.keys()) {
            if (key.toUpperCase()===upperCaseName) found = true;
        }
        for (const key of this._secrets.keys()) {
            if (key.toUpperCase()===upperCaseName) found = true;
        }

        return found;
    }

    allKeys(): string[] {
        return [...this._parameters.keys(), ...this._featureFlags.keys(), ...this._secrets.keys()];
    }

    public ApplyFromEnvVars(prefix:string){
        for(const paramName of this._parameters.keys()){
            const envVarName = prefix+paramName.toUpperCase();
            if(process.env[envVarName] != undefined){
                const value = this._getParamValueFromString(this._parameters.get(paramName)!, process.env[envVarName]!);
                this._setParamValue(paramName, value);
            }
        }

        for(const featureFlagName of this._featureFlags.keys()){
            const envVarName = prefix+featureFlagName.toUpperCase();
            if(process.env[envVarName] != undefined){
                const value = process.env[envVarName]!.toLowerCase() === "true";
                this._setFeatureFlagValue(featureFlagName, value);
            }
        }

        for(const secretName of this._secrets.keys()){
            const envVarName = prefix+secretName.toUpperCase();
            if(process.env[envVarName] != undefined){
                this._setSecretValue(secretName, process.env[envVarName]!);
            }
        }
    }

    /**
     * Note: this does not enforce matching env or schemaVersion
     * @param data
     * @constructor
     */
    public SetFromJsonObj(data:ConfigurationSet):void{
        this._schemaVersion = data.schemaVersion;
        this._iterationNumber = data.iterationNumber;

        // clear all first
        this._parameters.clear();
        this._featureFlags.clear();
        this._secrets.clear();

        for(const param of data.parameters){
            this._addNewParam(param.name, param.type, param.defaultValue, param.description);
            this._setParamValue(param.name, param.currentValue);
        }

        for(const featureFlag of data.featureFlags){
            this._addNewFeatureFlag(featureFlag.name, featureFlag.defaultValue, featureFlag.description);
            this._setFeatureFlagValue(featureFlag.name, featureFlag.currentValue);
        }

        for(const secret of data.secrets){
            this._addNewSecret(secret.name, secret.defaultValue, secret.description);
            this._setSecretValue(secret.name, secret.currentValue);
        }
    }

    public ToJsonObj():ConfigurationSet{
        return {
            schemaVersion: this._schemaVersion,
            iterationNumber: this._iterationNumber,
            parameters: Array.from(this._parameters.values()),
            featureFlags: Array.from(this._featureFlags.values()),
            secrets: Array.from(this._secrets.values())
        };
    }

    /*************************
     * params
     **************************/


    getParam(paramName: string): ConfigParameter | null {
        return this._parameters.get(paramName.toUpperCase()) ?? null;
    }

    getAllParams(): ConfigParameter[] {
        return Array.from(this._parameters.values());
    }

    protected _addParam(param: ConfigParameter): void {
        if (this.has(param.name.toUpperCase())) {
            throw new Error(`Duplicate config name detected - name: ${param.name}`);
        }

        this._parameters.set(param.name.toUpperCase(), param);
    }

    protected _addNewParam(name: string, type: ConfigParameterTypes, defaultValue: any, description: string, jsonSchema?: string): void {
        const param:ConfigParameter = {
            name: name,
            type: type,
            defaultValue: defaultValue,
            description: description,
            currentValue: defaultValue
        };

        // jsonSchema only for LIST and OBJECT
        if(jsonSchema && (type === ConfigParameterTypes.LIST || type === ConfigParameterTypes.OBJECT)){
            param.jsonSchema = jsonSchema;
        }

        // TODO validate

        if (this.has(param.name.toUpperCase())) {
            throw new Error(`Duplicate config name detected - name: ${name}`);
        }

        this._parameters.set(param.name.toUpperCase(), param);
    }

    protected _getParamValueFromString(param: ConfigParameter, value:string):any {
        if(param.type === ConfigParameterTypes.STRING){
            return value;
        }else if(param.type === ConfigParameterTypes.BOOL){
            return (value.toLowerCase() === "true");
        }else if(param.type === ConfigParameterTypes.INT_NUMBER){
            return parseInt(value);
        }else if(param.type === ConfigParameterTypes.FLOAT_NUMBER) {
            return parseFloat(value);
        }
    }

    protected _setParamValue(paramName:string, value:any):void{
        const param: ConfigParameter | null = this._parameters.get(paramName.toUpperCase()) ?? null;
        if(!param) {
            throw("param does not exit, cannot set value");
        }

        param.currentValue = value;
    }

    /*************************
     * feature flags
     **************************/

    getFeatureFlag(featureFlagName: string): ConfigFeatureFlag | null {
        return this._featureFlags.get(featureFlagName.toUpperCase()) ?? null;
    }

    getAllFeatureFlags(): ConfigFeatureFlag[] {
        return Array.from(this._featureFlags.values());
    }

    protected _addFeatureFlag(featureFlag: ConfigFeatureFlag): void {
        if (this.has(featureFlag.name.toUpperCase())) {
            throw new Error(`Duplicate config name detected - name: ${featureFlag.name}`);
        }

        this._featureFlags.set(featureFlag.name.toUpperCase(), featureFlag);
    }

    protected _addNewFeatureFlag(name: string, defaultValue: boolean, description: string): void {
        const featureFlag:ConfigFeatureFlag = {
            name: name,
            defaultValue: defaultValue,
            description: description,
            currentValue: defaultValue
        };
        if (this.has(featureFlag.name.toUpperCase())) {
            throw new Error(`Duplicate config name detected - name: ${name}`);
        }

        this._featureFlags.set(featureFlag.name.toUpperCase(), featureFlag);
    }

    protected _setFeatureFlagValue(featureFlagName:string, value:boolean):void{
        const featureFlag: ConfigFeatureFlag | null = this._featureFlags.get(featureFlagName.toUpperCase()) ?? null;
        if(!featureFlag) {
            throw("featureFlag does not exit, cannot set value");
        }

        featureFlag.currentValue = value;
    }

    /*************************
     * secrets
     **************************/

    getSecret(secretName: string): ConfigSecret | null {
        return this._secrets.get(secretName.toUpperCase()) ?? null;
    }

    getAllSecrets(): ConfigSecret[] {
        return Array.from(this._secrets.values());
    }

    protected _addSecret(secret: ConfigSecret): void {
        if (this.has(secret.name.toUpperCase())) {
            throw new Error(`Duplicate config name detected - name: ${secret.name}`);
        }

        this._secrets.set(secret.name.toUpperCase(), secret);
    }

    protected _addNewSecret(name: string, defaultValue: string | null, description: string): void {
        const secret:ConfigSecret = {
            name: name,
            defaultValue: defaultValue,
            description: description,
            currentValue: defaultValue ?? ""
        };

        if (this.has(secret.name.toUpperCase())) {
            throw new Error(`Duplicate config name detected - name: ${name}`);
        }

        this._secrets.set(secret.name.toUpperCase(), secret);
    }

    protected _setSecretValue(secretName:string, value:string):void{
        const secret: ConfigSecret | null = this._secrets.get(secretName.toUpperCase()) ?? null;
        if(!secret) {
            throw("secret does not exit, cannot set value");
        }

        secret.currentValue = value;
    }
}


export class BoundedContextConfigurationClientMock extends BaseConfigurationMockClient implements IBoundedContextConfigurationClient {
    constructor(schemaVersion?:string) {
        super(schemaVersion);
    }

    /*************************
     * params - public change methods
     **************************/

    addParam(param: ConfigParameter): void {
        this._addParam(param);
    }

    addNewParam(name: string, type: ConfigParameterTypes, defaultValue: any, description: string, jsonSchema?: string): void {
        this._addNewParam(name, type, defaultValue, description, jsonSchema);
    }

    /*************************
     * feature flags - public change methods
     **************************/

    addFeatureFlag(featureFlag: ConfigFeatureFlag): void {
        this._addFeatureFlag(featureFlag);
    }

    addNewFeatureFlag(name: string, defaultValue: boolean, description: string): void {
        this._addNewFeatureFlag(name, defaultValue, description);
    }

    /*************************
     * secrets - public change methods
     **************************/

    addSecret(secret: ConfigSecret): void {
        this._addSecret(secret);
    }

    addNewSecret(name: string, defaultValue: string | null, description: string): void {
        this._addNewSecret(name, defaultValue, description);
    }
}


export class GlobalConfigurationClientMock extends BaseConfigurationMockClient implements IGlobalConfigurationClient {
    constructor() {
        super();
    }

    /*************************
     * params - public change methods
     **************************/
    getCurrencies(): Currency[] {
        const currencies: Currency[] = [];
        currencies.push(
            {code: "EUR", decimals: 2, num: "978"},
            {code: "USD", decimals: 2, num: "840"},
            {code: "ZAR", decimals: 2, num: "710"},
            {code: "TZS", decimals: 2, num: "834"},
        );
        return currencies;
    }
}
