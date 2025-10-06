const express = require("express");
const { Readable } = require("node:stream");
const crypto = require("node:crypto");
const Table = require("cli-table3");

const app = express();
app.use(express.json({ limit: "2mb" }));

// ---- Config ----
const LONGCAT_BASE = process.env.LONGCAT_BASE || "https://api.longcat.chat/openai/v1";
const LONGCAT_KEY = process.env.LONGCAT_KEY;
const PROXY_TOKEN = process.env.PROXY_TOKEN; // optional shared secret

const DEBUG = process.env.DEBUG === "1";
const DEBUG_HEADERS = process.env.DEBUG_HEADERS === "1";
const DEBUG_BODY = process.env.DEBUG_BODY === "1";
const MAX_BODY_PREVIEW = Number(process.env.DEBUG_BODY_MAX || 800);
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes for disconnected responses

const COST_PER_MILLION_PROMPT = parseFloat(process.env.COST_PER_MILLION_PROMPT_TOKENS || "0");
const COST_PER_MILLION_COMPLETION = parseFloat(process.env.COST_PER_MILLION_COMPLETION_TOKENS || "0");
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity triggers session summary

const MODEL_MAP = {
    "gpt-4": "LongCat-Flash-Thinking",
    "gpt-4-turbo": "LongCat-Flash-Thinking",
    "gpt-3.5-turbo": "LongCat-Flash-Chat",
};


// ---- Metrics & Cache ----
const metrics = {
    startTime: Date.now(),
    totalRequests: 0,
    proxiedRequests: 0,
    cachedResponses: 0,
    retryAttempts: 0,
    // Lifetime stats are for the entire process
    lifetime_prompt_tokens: 0,
    lifetime_completion_tokens: 0,
    // Session stats reset after a period of inactivity
    session_prompt_tokens: 0,
    session_completion_tokens: 0,
    session_turn_count: 0,
    session_total_api_duration_ms: 0,
    session_start_time: 0,
    // Last turn stats are for the most recent request
    last_turn_prompt_tokens: 0,
    last_turn_completion_tokens: 0,
    last_turn_api_duration_ms: 0,
    lastError: null,
    lastErrorTs: null,
};

const responseCache = new Map();
let modelsCache = null;
let modelsCacheTimestamp = 0;
let sessionTimeoutId = null;


// ---- Helpers ----
const nowISO = () => new Date().toISOString();
const rid = () => crypto.randomBytes(6).toString("hex");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function log(ctx, msg, extra = {}) {
    if (!DEBUG) return;
    const context = (ctx && typeof ctx === 'object') ? ctx : {};
    console.log(JSON.stringify({ t: nowISO(), rid: context.rid || 'SYSTEM', msg, ...extra }));
}

const getRequestHash = (req) => crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
const countTokens = (text) => Math.ceil((text || "").length / 4);
const formatNumber = (num) => num.toLocaleString('en-US');
const formatDuration = (ms) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
};


// **NEW**: A stylish greeting message with an ASCII logo.
function showGreeting() {
    const logo = `
    ██╗      █████╗ ██████╗ ███████╗███████╗██████╗ 
    ██║     ██╔══██╗██╔══██╗██╔════╝██╔════╝██╔══██╗
    ██║     ███████║██████╔╝█████╗  █████╗  ██████╔╝
    ██║     ██╔══██║██╔══██╗██╔══╝  ██╔══╝  ██╔══██╗
    ███████╗██║  ██║██████╔╝███████╗███████╗██████╔
    ╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝
    `;
    console.log(logo);
    console.log("Welcome to the Labeeb MoE Proxy!");
    console.log("---------------------------------");
    console.log("1. Your IDE is now connected to the LongCat API.");
    console.log("2. Session usage stats will be shown on exit or after 5 mins of inactivity.");
    console.log("3. Use Ctrl+C to gracefully shut down the server.\n");
}


// **NEW**: The session report, now using cli-table3 for a professional look.
function endSession() {
    if (metrics.session_turn_count === 0) {
        log(null, "Session ended with no activity.");
        return;
    }

    const lastTotalTokens = metrics.last_turn_prompt_tokens + metrics.last_turn_completion_tokens;
    const cumulativeTotalTokens = metrics.session_prompt_tokens + metrics.session_completion_tokens;

    const table = new Table({
        head: [{content: 'Stats', colSpan: 2, hAlign: 'center'}],
        chars: { 'top': '─' , 'top-mid': '┬' , 'top-left': '┌' , 'top-right': '┐'
            , 'bottom': '─' , 'bottom-mid': '┴' , 'bottom-left': '└' , 'bottom-right': '┘'
            , 'left': '│' , 'left-mid': '├' , 'mid': '─' , 'mid-mid': '┼'
            , 'right': '│' , 'right-mid': '┤' , 'middle': '│' }
    });

    const lastTurnTable = new Table({
        head: ['Last Turn'],
        colWidths: [30]
    });
    lastTurnTable.push(
        [`Input Tokens: ${formatNumber(metrics.last_turn_prompt_tokens)}`],
        [`Output Tokens: ${formatNumber(metrics.last_turn_completion_tokens)}`],
        [`Total Tokens: ${formatNumber(lastTotalTokens)}`],
        [`Turn Duration (API): ${formatDuration(metrics.last_turn_api_duration_ms)}`]
    );

    const cumulativeTable = new Table({
        head: [`Cumulative (${metrics.session_turn_count} Turns)`],
        colWidths: [30]
    });
    cumulativeTable.push(
        [`Input Tokens: ${formatNumber(metrics.session_prompt_tokens)}`],
        [`Output Tokens: ${formatNumber(metrics.session_completion_tokens)}`],
        [`Total Tokens: ${formatNumber(cumulativeTotalTokens)}`],
        [`Total duration (API): ${formatDuration(metrics.session_total_api_duration_ms)}`],
        [`Total duration (wall): ${formatDuration(Date.now() - metrics.session_start_time)}`]
    );

    table.push([lastTurnTable.toString(), cumulativeTable.toString()]);

    console.log("\n--- Session Summary ---");
    console.log(table.toString());
    console.log("-----------------------\n");

    metrics.session_turn_count = 0;
    sessionTimeoutId = null;
}


function startOrContinueSession() {
    if (metrics.session_turn_count === 0) {
        log(null, "Starting new session.");
        metrics.session_prompt_tokens = 0;
        metrics.session_completion_tokens = 0;
        metrics.session_total_api_duration_ms = 0;
        metrics.session_start_time = Date.now();
    }
}

function resetSessionTimer() {
    if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
    sessionTimeoutId = setTimeout(endSession, SESSION_TIMEOUT_MS);
}


// ---- Middleware ----
app.use((req, res, next) => {
    if (!PROXY_TOKEN) return next();
    if (req.headers["authorization"] !== `Bearer ${PROXY_TOKEN}` && req.headers["x-proxy-token"] !== PROXY_TOKEN) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
});

app.use((req, res, next) => {
    resetSessionTimer();
    startOrContinueSession();
    metrics.totalRequests++;
    const ctx = { rid: rid(), start: process.hrtime.bigint() };
    req.ctx = ctx;
    res.locals.promptTokens = 0;
    res.locals.completionTokens = 0;

    if (DEBUG) {
        const info = { method: req.method, url: req.originalUrl, ip: req.ip };
        if (DEBUG_HEADERS) info.headers = req.headers;
        if (DEBUG_BODY && req.body && Object.keys(req.body).length) {
            const bodyStr = JSON.stringify(req.body);
            info.bodyPreview = bodyStr.length > MAX_BODY_PREVIEW ? bodyStr.slice(0, MAX_BODY_PREVIEW) + `…(${bodyStr.length} bytes)` : bodyStr;
        }
        log(ctx, "request.start", info);
    }

    res.on("finish", () => {
        const end = process.hrtime.bigint();
        const ms = Number(end - ctx.start) / 1e6;

        const { promptTokens, completionTokens } = res.locals;

        if (promptTokens > 0 || completionTokens > 0) {
            metrics.last_turn_prompt_tokens = promptTokens;
            metrics.last_turn_completion_tokens = completionTokens;
            metrics.last_turn_api_duration_ms = ms;

            metrics.session_total_api_duration_ms += ms;
            metrics.session_turn_count++;
        }

        log(ctx, "request.end", { status: res.statusCode, duration_ms: Math.round(ms) });
    });

    next();
});

// ---- Routes ----
app.get("/health", (_req, res) => res.json({ ok: true, ts: nowISO() }));
app.get("/_metrics", (_req, res) => res.json({ uptime_s: Math.round((Date.now() - metrics.startTime) / 1000), ...metrics }));
app.get("/v1/models", (req, res) => {
    const now = Date.now();
    if (modelsCache && (now - modelsCacheTimestamp < 300000)) {
        log(req.ctx, "models.cache.hit");
        return res.json(modelsCache);
    }
    log(req.ctx, "models.cache.miss");
    const response = {
        object: "list",
        data: [
            { id: "LongCat-Flash-Chat", object: "model", owned_by: "longcat" },
            { id: "LongCat-Flash-Thinking", object: "model", owned_by: "longcat" },
            { id: "gpt-4", object: "model", owned_by: "openai" },
            { id: "gpt-3.5-turbo", object: "model", owned_by: "openai" },
        ],
    };
    modelsCache = response;
    modelsCacheTimestamp = now;
    res.json(response);
});
app.get("/v1/results/:rid", (req, res) => {
    const { rid } = req.params;
    const cached = responseCache.get(rid);
    if (cached) {
        log({ rid }, "cache.hit");
        res.status(cached.status).set(cached.headers).send(cached.body);
        responseCache.delete(rid);
    } else {
        log({ rid }, "cache.miss");
        res.status(404).json({ error: "Result not found, expired, or already retrieved." });
    }
});

// ---- Core Logic ----
async function aggregateStream(stream, ctx) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let aggregatedContent = "";
    let firstChunk = null;
    let buffer = "";
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.substring(6).trim();
                if (jsonStr === '[DONE]') continue;
                try {
                    const chunkData = JSON.parse(jsonStr);
                    if (!firstChunk) firstChunk = chunkData;
                    aggregatedContent += chunkData.choices?.[0]?.delta?.content || "";
                } catch (e) {
                    log(ctx, "stream.parse.error", { error: String(e), line });
                }
            }
        }
    } catch (e) {
        log(ctx, "stream.read.error", { error: String(e) });
    } finally {
        reader.releaseLock();
    }
    if (!firstChunk) {
        log(ctx, "stream.aggregate.error", { msg: "No valid chunks received" });
        return null;
    }
    firstChunk.choices[0] = {
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content: aggregatedContent },
    };
    delete firstChunk.choices[0].delta;
    return firstChunk;
}
async function withBackoff(ctx, url, opts, tries = 8) {
    let delay = 500;
    for (let i = 1; i <= tries; i++) {
        try {
            const res = await fetch(url, opts);
            if (res.ok) {
                if (i > 1) log(ctx, "retry.success", { attempt: i, status: res.status });
                return res;
            }
            const retryable = [429, 500, 502, 503, 504].includes(res.status);
            log(ctx, "upstream.error", { status: res.status, attempt: i, retryable });
            if (!retryable || i === tries) return res;
        } catch (e) {
            if (e.name === 'AbortError') {
                log(ctx, "fetch.aborted.by.client");
                throw e;
            }
            log(ctx, "fetch.error", { error: String(e), attempt: i });
            if (i === tries) throw e;
        }
        metrics.retryAttempts++;
        log(ctx, "retry.backoff", { attempt: i + 1, wait_ms: delay });
        await sleep(delay + Math.floor(Math.random() * 250));
        delay = Math.min(delay * 2, 8000);
    }
    throw new Error("Backoff loop completed without returning a response.");
}

async function handleStreamingRequest(req, res, ctx, url, headers) {
    const promptText = req.body.messages.map(m => m.content).join('\n');
    res.locals.promptTokens = countTokens(promptText);
    metrics.session_prompt_tokens += res.locals.promptTokens;

    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive', 'Cache-Control': 'no-cache' });
    const abortController = new AbortController();
    const pingInterval = setInterval(() => { if (!res.writableEnded) res.write(': ping\n\n') }, 15000);
    const onClientClose = () => {
        clearInterval(pingInterval);
        if (!abortController.signal.aborted) {
            abortController.abort();
            log(ctx, "client.disconnected.aborting.upstream");
        }
    };
    res.on('close', onClientClose);

    try {
        const upstream = await withBackoff(ctx, url, { method: req.method, headers, body: JSON.stringify(req.body), signal: abortController.signal });
        clearInterval(pingInterval);

        if (!upstream.ok || !upstream.body) { /* error handling */ return; }

        const upstreamStream = Readable.fromWeb(upstream.body);
        for await (const chunk of upstreamStream) {
            if (res.writableEnded) {
                log(ctx, "client.disconnected.midstream.caching");
                const remainingStream = new Readable({
                    read() {
                        this.push(chunk);
                        upstreamStream.on('data', (d) => this.push(d));
                        upstreamStream.on('end', () => this.push(null));
                    }
                });
                const aggregated = await aggregateStream(remainingStream.toWeb(), ctx);
                if (aggregated) {
                    res.locals.completionTokens = countTokens(aggregated.choices[0].message.content);
                    metrics.session_completion_tokens += res.locals.completionTokens;

                    const finalBody = JSON.stringify(aggregated);
                    responseCache.set(ctx.rid, {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                        body: finalBody,
                    });
                    setTimeout(() => responseCache.delete(ctx.rid), CACHE_TTL_MS);
                    metrics.cachedResponses++;
                    log(ctx, "response.cached", { rid: ctx.rid });
                }
                return;
            }
            res.write(chunk);
        }

    } catch (e) { /* error handling */ } finally {
        clearInterval(pingInterval);
        res.off('close', onClientClose);
        if (!res.writableEnded) {
            res.end();
        }
    }
}

async function handleNonStreamingRequest(req, res, ctx, url, headers) {
    const requestHash = getRequestHash(req);
    const cached = responseCache.get(requestHash);
    if (cached) { return res.status(cached.status).set(cached.headers).send(cached.body); }

    const promptText = req.body.messages.map(m => m.content).join('\n');
    res.locals.promptTokens = countTokens(promptText);
    metrics.session_prompt_tokens += res.locals.promptTokens;

    try {
        const upstream = await withBackoff(ctx, url, { method: req.method, headers, body: JSON.stringify(req.body) });
        const finalBody = Buffer.from(await upstream.arrayBuffer());

        try {
            const jsonBody = JSON.parse(finalBody.toString());
            res.locals.completionTokens = countTokens(jsonBody.choices?.[0]?.message?.content);
            metrics.session_completion_tokens += res.locals.completionTokens;
        } catch (e) { /* ... */ }

        // set cache and send response
        const finalHeaders = { 'Content-Type': upstream.headers.get('content-type') || 'application/json' };
        responseCache.set(requestHash, { status: upstream.status, headers: finalHeaders, body: finalBody });
        setTimeout(() => responseCache.delete(requestHash), 90 * 1000); // 90 second TTL

        if (res.closed) { return; }
        res.status(upstream.status).set(finalHeaders).send(finalBody);

    } catch (e) {
        if (!res.headersSent) {
            res.status(502).json({ error: "Upstream proxy error", detail: String(e) });
        }
    }
}

app.all("/v1/:path(*)", async (req, res) => {
    if (req.params.path.startsWith('results/')) {
        return res.status(404).json({ error: "Not found." });
    }
    metrics.proxiedRequests++;
    const ctx = req.ctx;
    const url = `${LONGCAT_BASE}/${req.params.path}`;
    if (req.body && typeof req.body === 'object') {
        if (req.body.model && MODEL_MAP[req.body.model]) {
            const originalModel = req.body.model;
            req.body.model = MODEL_MAP[originalModel];
            log(ctx, "model.map", { from: originalModel, to: req.body.model });
        }
        if (!req.body.user) {
            req.body.user = req.ip;
        }
    }
    const headers = { ...req.headers };
    ['host', 'content-length', 'x-proxy-token', 'connection', 'accept-encoding'].forEach(h => delete headers[h]);
    headers.authorization = `Bearer ${LONGCAT_KEY}`;
    headers["content-type"] = "application/json";
    log(ctx, "proxy.forward", { url, stream: req.body?.stream, method: req.method, model: req.body?.model, result_url: `/v1/results/${ctx.rid}` });
    if (req.body?.stream) {
        handleStreamingRequest(req, res, ctx, url, headers);
    } else {
        handleNonStreamingRequest(req, res, ctx, url, headers);
    }
});

// ---- Start Server ----
const port = process.env.PORT || 8787;
const host = process.env.HOST || "0.0.0.0";

if (!LONGCAT_KEY) {
    console.error("FATAL: LONGCAT_KEY environment variable is not set.");
    process.exit(1);
}

const server = app.listen(port, host, () => {
    showGreeting();
    console.log(`[INFO] MoE Proxy is running on http://${host}:${port}`);
    console.log(`[INFO] Forwarding requests to ${LONGCAT_BASE}`);
    console.log(`[INFO] Debug mode: ${DEBUG ? "ON" : "OFF"}`);
});

const activeSockets = new Set();
server.on('connection', (socket) => {
    activeSockets.add(socket);
    socket.on('close', () => {
        activeSockets.delete(socket);
    });
});

const cleanupAndExit = () => {
    console.log("\n[INFO] Shutting down proxy server...");
    if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
    endSession();

    server.close(() => {
        console.log("[INFO] Server closed. Exiting.");
        process.exit(0);
    });

    for (const socket of activeSockets) {
        socket.destroy();
    }
};

process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);
