#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";

import { Command } from "commander";
import { SerialPort } from "serialport";

function formatChunk(
    chunk: Buffer,
    direction: "in" | "out",
    type: "text" | "binary"
): string {
    const timestamp = new Date().toISOString();
    const marker = direction === "in" ? "<--" : "-->";
    if (type === "text") {
        const lines = chunk.toString('utf-8').replace(/\r?\n$/, '').split(/\r?\n/);
        if (lines.length == 0 || lines.filter(line => line.length != 0).length == 0) {
            return "";
        }
        return lines.map(line => `[${timestamp}] ${marker} ${line}`).join('\n') + '\n';
    } else {
        const formatted = (chunk.toString('hex').match(/../g)?.join(' ') || '');
        return `[${timestamp}] ${marker} ${formatted}\n`;
    }
}

function main(
    targetPath: string,
    targetBaudRate: number,
    passthruPath: string,
    passthruBaudRate: number,
    inputType: "text" | "binary",
    outputType: "text" | "binary"
): void {
    console.log(`targetPath: ${targetPath}`);
    console.log(`targetBaudRate: ${targetBaudRate}`);
    console.log(`passthruPath: ${passthruPath}`);
    console.log(`passthruBaudRate: ${passthruBaudRate}`);
    console.log(`inputType: ${inputType}`);
    console.log(`outputType: ${outputType}`);
    console.log("--------------------");

    const target = new SerialPort({
        path: targetPath,
        baudRate: targetBaudRate
    });
    const passthru = new SerialPort({
        path: passthruPath,
        baudRate: passthruBaudRate
    });

    target.on("data", (chunk: Buffer) => {
        passthru.write(chunk);
        process.stdout.write(formatChunk(chunk, "out", outputType));
    });
    passthru.on("data", (chunk: Buffer) => {
        target.write(chunk);
        process.stdout.write(formatChunk(chunk, "in", inputType));
    });
}

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const packageJsonPath = path.join(dirname, "..", "package.json");
const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));

new Command()
    .version(packageJson.version)
    .requiredOption("--target-path <path>")
    .requiredOption("--target-baud-rate <baudRate>")
    .requiredOption("--passthru-path <path>")
    .option("--passthru-baud-rate <baudRate>")
    .requiredOption("--input-type <type>")
    .requiredOption("--output-type <type>")
    .action((options) => {
        [options.inputType, options.outputType].forEach((value: string) => {
            if (!["text", "binary"].includes(value)) {
                throw new Error(`invalid type: ${value}`)
            }
        });
        options.passthruBaudRate ||= options.targetBaudRate;
        options.targetBaudRate = parseInt(options.targetBaudRate);
        options.passthruBaudRate = parseInt(options.passthruBaudRate);

        main(
            options.targetPath,
            options.targetBaudRate,
            options.passthruPath,
            options.passthruBaudRate,
            options.inputType,
            options.outputType
        );
    })
    .parse();