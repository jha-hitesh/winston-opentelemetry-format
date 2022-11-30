const os = require("os");
const winston = require("winston");
const TransportStream = require('winston-transport');
const { JasmineExpect } = require("jasmine-expect");
const { opentelemetryLogFormat } = require("../index.js").utils;

global.logList = new Array();
// a custom array transport for testing, but this format can be used with any transport of user's choice.

class ArrayTransport extends TransportStream {
    log(info, callback) {
        logList.push(info)
        console.log(info)
    }
}
const logger = winston.createLogger({
    level: "debug",
    format: opentelemetryLogFormat({
        "filename": __filename,
        "useTraces": true,
        "restrictLogAttributesTo": [
            "key1", "key2", "key3"
        ],
        "discardLogAttributesFrom": [],
        "logMetaCharacterLimit": 100,
        "logBodyCharacterLimit": 10,
        "resourceAttributes": {
            "service.name": "app-main-server",  // mandatory key
            "service.instance.id": os.hostname()  // optional key
        }
    }),
    defaultMeta: {},
    transports: [
        new ArrayTransport()
    ],
});

function basicExceptations(log) {
    expect(log.body.length).toBeWithinRange(0, 10);
    if (log.attributes.meta){
        expect(log.attributes.meta.length).toBeWithinRange(0, 100);
    }
    expect(log.resource["service.name"]).toBe("app-main-server");
    expect(log.resource["service.instance.id"]).toStrictEqual(expect.anything());
}
describe('winston opentelemetry format', () => {
    test('basic log test', () => {
        logger.debug("test message", {"key1": "test", "metakey1": "metavalue1"})
        basicExceptations(logList[logList.length-1]);
    });
});
