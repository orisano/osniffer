# osniffer
HTTP通信を覗き見るためのプロキシを作るライブラリです.

## Install
```bash
npm install osniffer
```

## Requirements
Node.js >= 7.6.0

## Example
content-typeがapplication/jsonの通信をconsoleに出力する例
```js
const zlib = require("zlib");

const es = require("event-stream");

const Sniffer = require("osniffer");
const sniffer = new Sniffer();

sniffer.use(async (ctx, next) => {
    if (ctx.response.headers["content-type"] === "application/json") {
        await next();
    }
});
sniffer.use(async (ctx, next) => {
    ctx.response
        .pipe(zlib.createGunzip())
        .pipe(es.wait())
        .pipe(es.parse())
        .pipe(es.map(x => console.log(x)));
    await next();
});
sniffer.listen(8080);
```

## Author
Nao YONASHIRO(@orisano)

## License
MIT
