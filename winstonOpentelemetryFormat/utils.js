const format = require("winston").format;
const os = require("os");
const opentelemetryApi = require("@opentelemetry/api");

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
        "telemetry.sdk.language": "nodejs",
        "telemetry.sdk.name": "opentelemetry",
        "telemetry.sdk.version": "1.8.0", // Todo: replace with code to fetch package version
        "traceclue.version": "1.8.0"
    }
    missingLogBodyMessage = "MissingLogBody"
    logBodyTooLargeAttributeName = "log_body_too_large"
    logBodyCharLengthAttributeName = "log_body_character_length"

    logMetaAttributeName = "meta"
    logMetaTooLargeAttributeName = "log_meta_too_large"
    logMetaCharLengthAttributeName = "log_meta_character_length"

    constructor(config) {
        this.resourceAttributes = config.resourceAttributes || {}
        this.resourceAttributes = Object.assign({}, this.DefaultResourceAttributes, this.resourceAttributes)
        this.useTraces = config["useTraces"]
        this.logMetaCharacterLimit = config["logMetaCharacterLimit"]
        this.logBodyCharacterLimit = config["logBodyCharacterLimit"]
        if (!this.logMetaCharacterLimit){
            this.logMetaCharacterLimit = 1000
        }
        if (!this.logBodyCharacterLimit){
            this.logBodyCharacterLimit = 500
        }

        this.restrictLogAttributesTo = new Set()
        this.restrictLogAttributesTo.add(this.logBodyTooLargeAttributeName)
        this.restrictLogAttributesTo.add(this.logBodyCharLengthAttributeName)
        this.restrictLogAttributesTo.add(this.logMetaTooLargeAttributeName)
        this.restrictLogAttributesTo.add(this.logMetaCharLengthAttributeName)

        this.GetAttributes = this.getAttributesSimple
        if (config.restrictLogAttributesTo.length != 0){
            this.GetAttributes = this.getAttributesStructured
            this.restrictLogAttributesTo = new Set([...this.restrictLogAttributesTo, ...config.restrictLogAttributesTo])
        }
        this.discardLogAttributesFrom = new Set()
        if(config.discardLogAttributesFrom.length != 0){
            this.discardLogAttributesFrom = new Set(config.discardLogAttributesFrom)
        }
    }

    getAttributesStructured(rawAttributes) {
        let logMetaAttributes = {}
        let logAttributes = {}
        for (const property in rawAttributes) {
            if (this.discardLogAttributesFrom.has(property)) {
                continue
            }
            if (this.restrictLogAttributesTo.has(property)) {
                logAttributes[property] = rawAttributes[property]
            } else {
                logMetaAttributes[property] = rawAttributes[property]
            }
        }
        if (Object.keys(logMetaAttributes).length != 0) {
            logMetaAttributes = JSON.stringify(logMetaAttributes)
            if (logMetaAttributes.length > this.logMetaCharacterLimit) {
                logAttributes[this.logMetaCharLengthAttributeName] = logMetaAttributes.length
                logAttributes[this.logMetaTooLargeAttributeName] = true
                logMetaAttributes = logMetaAttributes.slice(0, this.logMetaCharacterLimit)
            }
            logAttributes[this.logMetaAttributeName] = logMetaAttributes
        }
        return logAttributes
    }

    getAttributesSimple(rawAttributes) {
        let logAttributes = {}
        for (const property in rawAttributes) {
            if (this.discardLogAttributesFrom.has(property)) {
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
        const splat = record[Symbol.for('splat')];
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
            body = this.missingLogBodyMessage
        } else if ( body.length > this.logBodyCharacterLimit) {
            rawAttributes[this.logBodyCharLengthAttributeName] = body.length
            rawAttributes[this.logBodyTooLargeAttributeName] = true
            body = body.slice(0,this.logBodyCharacterLimit)
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

function opentelemetryLogFormat(config) {
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