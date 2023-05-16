const format = require("winston").format;
const os = require("os");
const opentelemetryApi = require("@opentelemetry/api");
const { SemanticResourceAttributes } = require("@opentelemetry/semantic-conventions");
const { SDK_INFO } = require("@opentelemetry/core");

const severityNumber = {
    "debug": 5,
    "info": 9,
    "warning": 13,
    "error": 17,
    "emerg": 21,
    "alert": 21
}

class OpentelemetryLogFormatter {

    DefaultResourceAttributes = {
        [SemanticResourceAttributes.SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || "unknown_service",
        [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: os.hostname(),
        [SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE]: SDK_INFO[SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE],
        [SemanticResourceAttributes.TELEMETRY_SDK_NAME]: SDK_INFO[SemanticResourceAttributes.TELEMETRY_SDK_NAME],
        [SemanticResourceAttributes.TELEMETRY_SDK_VERSION]: SDK_INFO[SemanticResourceAttributes.TELEMETRY_SDK_VERSION],
    }
    missingBodyMessage = ""
    bodyTooLargeAttributeName = "_body_too_large"
    bodyCharLengthAttributeName = "_body_original_length"

    metaAttributeName = "_meta"
    metaTooLargeAttributeName = "_meta_too_large"
    metaCharLengthAttributeName = "_meta_original_length"

    constructor(config) {
        this.resourceAttributes = config.resourceAttributes || {}
        this.resourceAttributes = Object.assign({}, this.DefaultResourceAttributes, this.resourceAttributes)
        this.useTraces = "useTraces" in config? config["useTraces"]: true
        this.metaCharacterLimit = config["metaCharacterLimit"]
        this.bodyCharacterLimit = config["bodyCharacterLimit"]
        if (!this.metaCharacterLimit){
            this.metaCharacterLimit = 1000
        }
        if (!this.bodyCharacterLimit){
            this.bodyCharacterLimit = 500
        }

        this.restrictAttributesTo = new Set()
        this.restrictAttributesTo.add(this.bodyTooLargeAttributeName)
        this.restrictAttributesTo.add(this.bodyCharLengthAttributeName)
        this.restrictAttributesTo.add(this.metaTooLargeAttributeName)
        this.restrictAttributesTo.add(this.metaCharLengthAttributeName)

        this.GetAttributes = this.getAttributesSimple
        if (config.restrictAttributesTo && config.restrictAttributesTo.length != 0){
            this.GetAttributes = this.getAttributesStructured
            this.restrictAttributesTo = new Set([...this.restrictAttributesTo, ...config.restrictAttributesTo])
        }
        this.discardAttributesFrom = new Set()
        if(config.discardAttributesFrom && config.discardAttributesFrom.length != 0){
            this.discardAttributesFrom = new Set(config.discardAttributesFrom)
        }
    }

    getAttributesStructured(rawAttributes) {
        let logMetaAttributes = {}
        let logAttributes = {}
        for (const property in rawAttributes) {
            if (this.discardAttributesFrom.has(property)) {
                continue
            }
            if (this.restrictAttributesTo.has(property)) {
                logAttributes[property] = rawAttributes[property]
            } else {
                logMetaAttributes[property] = rawAttributes[property]
            }
        }
        if (Object.keys(logMetaAttributes).length != 0) {
            logMetaAttributes = JSON.stringify(logMetaAttributes)
            if (logMetaAttributes.length > this.metaCharacterLimit) {
                logAttributes[this.metaCharLengthAttributeName] = logMetaAttributes.length
                logAttributes[this.metaTooLargeAttributeName] = true
                logMetaAttributes = logMetaAttributes.slice(0, this.metaCharacterLimit)
            }
            logAttributes[this.metaAttributeName] = logMetaAttributes
        }
        return logAttributes
    }

    getAttributesSimple(rawAttributes) {
        let logAttributes = {}
        for (const property in rawAttributes) {
            if (this.discardAttributesFrom.has(property)) {
                continue
            }
            logAttributes[property] = rawAttributes[property]
        }
        return logAttributes
    }

    levelToNumber(level) {
        return severityNumber[level]
    }

    getTraceRelatedData() {
        let spanId = "";
        let traceId = "";
        let traceFlags = 0;
        if (this.useTraces){
            const activeSpan = opentelemetryApi.trace.getActiveSpan();
            if (activeSpan) {
                const spancontext = activeSpan.spanContext()
                traceId = spancontext.traceId
                spanId = spancontext.spanId
                traceFlags = spancontext.traceFlags
            }
        }
        return {
            "traceId": traceId,
            "spanId": spanId,
            "traceFlags": traceFlags
        } 
    }

    getRecordMeta(record) {
        const splat = record[Symbol.for("splat")];
        if (splat && splat.length) {
            return splat.length === 1 ? splat[0] : {"splat": splat};
        } else {
            return {}
        }
    }

    format(record, filename="") {
        this.resourceAttributes["pathname"] = filename || ""
        const traceData = this.getTraceRelatedData()
        let body = record.message
        let rawAttributes = this.getRecordMeta(record)
        if (typeof body == "object" && !Array.isArray(body)) {
            rawAttributes = Object.assign({}, rawAttributes, body)
            body = this.missingBodyMessage
        } else if ( body.length > this.bodyCharacterLimit) {
            rawAttributes[this.bodyCharLengthAttributeName] = body.length
            rawAttributes[this.bodyTooLargeAttributeName] = true
            body = body.slice(0,this.bodyCharacterLimit)
        }
        const timestamp = new Date()
        return {
            "body": body,
            "severity_number": this.levelToNumber(record.level),
            "severity_text": record.level,
            "attributes": this.GetAttributes(rawAttributes),
            "timestamp": timestamp.toISOString(),
            "trace_id": traceData.traceId,
            "span_id": traceData.spanId,
            "trace_flags": traceData.traceFlags,
            "resource": this.resourceAttributes,
            [Symbol.for("level")]: record.level
        }
    }
}

function opentelemetryLogFormat(config={}) {
    const _opentelemetryLogFormat = format((info, opts) => {
        return opts.opentelemetryLogFormatterObject.format(info, opts.filename)
    });
    const opentelemetryLogFormatterObject = new OpentelemetryLogFormatter(config)
    return _opentelemetryLogFormat({
        "filename": config.filename,
        "opentelemetryLogFormatterObject": opentelemetryLogFormatterObject
    });
}
module.exports = {
    opentelemetryLogFormat
}