# winston-opentelemetry-format

a simple winston format which can be used to format logs to opentelemetry specification coming out from a system.
it also provides some additional size control over log body and log attributes

#### Installation

- from npm
```
npm install winston-opentelemetry-format
```

#### Usage
- check [example](__tests__/test.logging.js) for a complete example
- the format is available as 
```
const { opentelemetryLogFormat } = require("winston-opentelemetry-format").utils;
```
- the format takes a single param which is an object with following keys and thier respective values.
- `filename`: filename of the logger which is doing the logging, usually pass `__filename`, the value is shown in resource.pathname
- `useTraces`: use the traces information to enrich logs or not(trace_id and span_id)
- `restrictAttributesTo`: array of attributes to which log's attributes should be restricted, any extra attributes passed inside log will be added against `_meta` inside attributes. value for `_meta` key is converted to string later on. 
- `metaCharacterLimit`: the max length of value for `_meta` in output logs' attributes, if the length of the calculated `_meta` exceeds this limit the value of `_meta` will be trimmed to specified length. also an attribute `_meta_original_length` is added with value as the length of original `_meta` and `_meta_too_large` with value `true` for debugging purpose.
- `bodyCharacterLimit`: the max length of value for log body, if the length of log body exceeds this limit the value of log body will be trimmed to specified value. also an attribute `_body_original_length` is added with value as the length of original log body and `_body_too_large` with value `true` for debugging purpose.
- `discardAttributesFrom`: an array of attributes which needs to be skipped when exporting logs

#### Local development and testing

- build the docker-image of the package `docker-compose build --no-cache`
- run the image `docker-compose up`
- go to the container `docker exec -it winston_optl_format_tester sh`
- to run tests first install jest `npm install jest` then `jest` to run the actual tests.

#### generate package-lock.json
- `npm i --package-lock-only`


#### License

- this project is licensed under [MIT License](LICENSE)
