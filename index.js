"use strict";

const http = require("http");
const net = require("net");
const url = require("url");

function printError(err, msg, url) {
    console.error(`${new Date().toLocaleDateString()} ${msg}: ${url} ${err}`);
}

class Sniffer {
    constructor() {
        this.middlewares = [];
        this.server = http.createServer();
    }

    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }

    onRequest(clientRequest, clientResponse) {
        if ("proxy-connection" in clientRequest.headers) {
            clientRequest.headers["connection"] = clientRequest.headers["proxy-connection"];
            delete clientRequest.headers["proxy-connection"];
            delete clientRequest.headers["cache-control"];
        }
        const clientSocket = clientRequest.socket || clientRequest.connection;
        const x = url.parse(clientRequest.url);
        const serverRequest = http.request({
            host: x.hostname,
            port: x.port || 80,
            path: x.path,
            method: clientRequest.method,
            headers: clientRequest.headers,
            agent: clientSocket.$agent,
        }, serverResponse => {
            clientResponse.writeHead(serverResponse.statusCode, serverResponse.headers);
            serverResponse.pipe(clientResponse);

            const ctx = {request: clientRequest, response: serverResponse};
            (async () => {
                await this.middlewares.reduceRight(
                        (acc, x) => (async () => x(ctx, acc)),
                        async () => {}
                )();
            })();
        });

        clientRequest.pipe(serverRequest);
        serverRequest.on("error", err => {
            clientResponse.writeHead(400, err.message, {"content-type": "text/html"});
            clientResponse.end(`<h1>${err.message}<br/>${clientRequest.url}</h1>`);
            printError(err, "serverRequest", `${x.hostname}:${x.port || 80}`);
        });
    }

    listen(port) {
        this.server.on("request", this.onRequest.bind(this));

        this.server.on("clientError", (err, clientSocket) => {
            clientSocket.end();
            printError(err, "cliErr", "");
        });

        this.server.on("connect", (clientRequest, clientSocket, clientHead) => {
            const x = url.parse("https://" + clientRequest.url);
            const serverSocket = net.connect(x.port || 443, x.hostname, () => {
                clientSocket.write("HTTP/1.1 200 Connection established\r\n\r\n");
                if (clientHead && clientHead.length) serverSocket.write(clientHead);
                clientSocket.pipe(serverSocket);
            });
            serverSocket.pipe(clientSocket);
            serverSocket.on("error", err => {
                clientSocket.end();
                printError(err, "serverSocket", clientRequest.url);
            });
            clientSocket.on("error", err => {
                if (serverSocket) serverSocket.end();
                printError(err, "clientSocket", clientRequest.url);
            });
        });

        this.server.on("connection", clientSocket => {
            clientSocket.$agent = new http.Agent({keepAlive: true});
        });
        return new Promise((resolve, reject) => {
            this.server.listen(port, resolve);
            this.server.on("error", reject);
        });
    }
}

module.exports = Sniffer;
