const path = require("path");
const Module = require("module");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
  try {
    return originalResolveFilename(request, parent, isMain);
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      const localNodeModules = path.join(__dirname, "node_modules");
      const originalPaths = Module._nodeModulePaths;
      Module._nodeModulePaths = function (from) {
        const paths = originalPaths.call(this, from);
        if (!paths.includes(localNodeModules)) {
          paths.unshift(localNodeModules);
        }
        return paths;
      };
      try {
        return originalResolveFilename(request, parent, isMain);
      } finally {
        Module._nodeModulePaths = originalPaths;
      }
    }
    throw err;
  }
};

const { NodeSDK } = require("@opentelemetry/sdk-node");
const {
  getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");

global.__ROUTE_REGISTRY__ = global.__ROUTE_REGISTRY__ || new Map();
global.__METRICS_REGISTRY__ = global.__METRICS_REGISTRY__ || null;

function parseDisabledInstrumentations(disabledString) {
  if (!disabledString) return {};

  const disabled = disabledString.split(",").map((s) => s.trim());
  const config = {};

  disabled.forEach((inst) => {
    const instrumentationMap = {
      fs: "@opentelemetry/instrumentation-fs",
      http: "@opentelemetry/instrumentation-http",
      https: "@opentelemetry/instrumentation-http",
      express: "@opentelemetry/instrumentation-express",
      fastify: "@opentelemetry/instrumentation-fastify",
      mysql: "@opentelemetry/instrumentation-mysql",
      pg: "@opentelemetry/instrumentation-pg",
      mongodb: "@opentelemetry/instrumentation-mongodb",
      redis: "@opentelemetry/instrumentation-redis",
      dns: "@opentelemetry/instrumentation-dns",
      net: "@opentelemetry/instrumentation-net",
      graphql: "@opentelemetry/instrumentation-graphql",
      aws: "@opentelemetry/instrumentation-aws-sdk",
      koa: "@opentelemetry/instrumentation-koa",
    };

    const fullName =
      instrumentationMap[inst] || `@opentelemetry/instrumentation-${inst}`;
    config[fullName] = { enabled: false };
  });

  return config;
}

const setupEnvironment = () => {
  let serviceInfo = { name: "unknown-nodejs-service", version: "1.0.0" };

  try {
    const packageInfo = require(process.cwd() + "/package.json");
    serviceInfo.name = packageInfo.name || serviceInfo.name;
    serviceInfo.version = packageInfo.version || serviceInfo.version;
  } catch (e) {}

  if (!process.env.OTEL_SERVICE_NAME) {
    process.env.OTEL_SERVICE_NAME = serviceInfo.name;
  }
  if (!process.env.OTEL_SERVICE_VERSION) {
    process.env.OTEL_SERVICE_VERSION = serviceInfo.version;
  }
  if (!process.env.OTEL_SERVICE_NAMESPACE) {
    process.env.OTEL_SERVICE_NAMESPACE = process.env.K8S_NAMESPACE || "default";
  }
  if (!process.env.OTEL_ENVIRONMENT) {
    process.env.OTEL_ENVIRONMENT = process.env.NODE_ENV || "development";
  }
  if (!process.env.OTEL_SERVICE_INSTANCE_ID) {
    process.env.OTEL_SERVICE_INSTANCE_ID =
      process.env.HOSTNAME ||
      process.env.POD_NAME ||
      process.env.K8S_POD_NAME ||
      `instance-${Date.now()}`;
  }

  if (
    !process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT &&
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ) {
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT + "/v1/traces";
  }
  if (
    !process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT &&
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ) {
    process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT + "/v1/metrics";
  }

  if (!process.env.OTEL_TRACES_EXPORTER) {
    process.env.OTEL_TRACES_EXPORTER = "otlp";
  }
  if (!process.env.OTEL_METRICS_EXPORTER) {
    process.env.OTEL_METRICS_EXPORTER = "otlp";
  }
};

setupEnvironment();

const disabledInstrumentations = parseDisabledInstrumentations(
  process.env.OTEL_NODE_DISABLED_INSTRUMENTATIONS
);

function initCustomMetrics() {
  try {
    const { metrics } = require("@opentelemetry/api");
    const meter = metrics.getMeter("custom-metrics", "1.0.0");

    const httpServerDuration = meter.createHistogram(
      "http_server_duration_milliseconds",
      {
        description: "HTTP server request duration with route labels",
        unit: "ms",
      }
    );

    const httpRequestsTotal = meter.createCounter("http_requests_total", {
      description: "Total HTTP requests with route labels",
    });

    const httpRequestSize = meter.createHistogram("http_request_size_bytes", {
      description: "HTTP request size with route labels",
      unit: "bytes",
    });

    const httpResponseSize = meter.createHistogram("http_response_size_bytes", {
      description: "HTTP response size with route labels",
      unit: "bytes",
    });

    global.__METRICS_REGISTRY__ = {
      httpServerDuration,
      httpRequestsTotal,
      httpRequestSize,
      httpResponseSize,
      meter,
    };

    return true;
  } catch (e) {
    console.warn("Could not initialize custom metrics:", e.message);
    return false;
  }
}

function recordCustomMetrics(
  method,
  route,
  statusCode,
  duration,
  request,
  reply
) {
  if (!global.__METRICS_REGISTRY__) return;

  try {
    const labels = {
      http_method: method,
      http_route: route,
      http_status_code: statusCode.toString(),
      service_name: process.env.OTEL_SERVICE_NAME || "nodejs-app",
    };

    global.__METRICS_REGISTRY__.httpServerDuration.record(duration, labels);
    global.__METRICS_REGISTRY__.httpRequestsTotal.add(1, labels);

    try {
      if (request?.headers?.["content-length"]) {
        const requestSize = parseInt(request.headers["content-length"]) || 0;
        global.__METRICS_REGISTRY__.httpRequestSize.record(requestSize, labels);
      }

      if (reply?.getHeaders?.()?.["content-length"]) {
        const responseSize =
          parseInt(reply.getHeaders()["content-length"]) || 0;
        global.__METRICS_REGISTRY__.httpResponseSize.record(
          responseSize,
          labels
        );
      }
    } catch (e) {}
  } catch (e) {
    console.warn("Error recording custom metric:", e.message);
  }
}

const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  const result = originalRequire.apply(this, arguments);

  if (id === "fastify" && typeof result === "function") {
    const originalFastify = result;

    const enhancedFastify = function (...args) {
      const instance = originalFastify(...args);

      setTimeout(() => {
        if (!global.__METRICS_REGISTRY__) {
          initCustomMetrics();
        }
      }, 3000);

      instance.addHook("onRoute", (routeOptions) => {
        const method = Array.isArray(routeOptions.method)
          ? routeOptions.method.join("|")
          : routeOptions.method;
        const url = routeOptions.url;
        const key = `${method}:${url}`;

        global.__ROUTE_REGISTRY__.set(key, {
          method: method,
          url: url,
          pattern: url,
        });
      });

      instance.addHook("onRequest", async (request, reply) => {
        request._startTime = Date.now();

        try {
          const { trace } = require("@opentelemetry/api");
          const span = trace.getActiveSpan();

          let routePattern = null;
          const requestMethod = request.method;
          const requestUrl = request.url.split("?")[0];

          if (request.routeOptions?.url) {
            routePattern = request.routeOptions.url;
          } else if (request.context?.config?.url) {
            routePattern = request.context.config.url;
          } else {
            for (const [key, route] of global.__ROUTE_REGISTRY__.entries()) {
              const [storedMethod, storedPattern] = key.split(":");

              if (
                storedMethod === requestMethod ||
                storedMethod.includes(requestMethod)
              ) {
                if (matchRoute(requestUrl, storedPattern)) {
                  routePattern = storedPattern;
                  break;
                }
              }
            }
          }

          if (routePattern) {
            if (span) {
              span.setAttributes({
                "http.route": routePattern,
                "fastify.route.pattern": routePattern,
                "fastify.route.method": requestMethod,
                "fastify.route.matched": "true",
              });
            }
            request._routePattern = routePattern;
          } else {
            const fallbackRoute = requestUrl
              .replace(/\/\d+/g, "/:id")
              .replace(/\/[a-f0-9-]{36}/g, "/:uuid");
            if (span) {
              span.setAttributes({
                "http.route": fallbackRoute,
                "fastify.route.pattern": fallbackRoute,
                "fastify.route.method": requestMethod,
                "fastify.route.matched": "fallback",
              });
            }
            request._routePattern = fallbackRoute;
          }
        } catch (error) {}
      });

      instance.addHook("onResponse", async (request, reply) => {
        try {
          const duration = Date.now() - (request._startTime || Date.now());
          const method = request.method;
          const route = request._routePattern || "unknown";
          const statusCode = reply.statusCode;

          recordCustomMetrics(
            method,
            route,
            statusCode,
            duration,
            request,
            reply
          );
        } catch (error) {}
      });

      return instance;
    };

    Object.setPrototypeOf(enhancedFastify, originalFastify);
    Object.defineProperty(enhancedFastify, "name", {
      value: originalFastify.name,
    });

    Object.getOwnPropertyNames(originalFastify).forEach((key) => {
      if (key !== "length" && key !== "name" && key !== "prototype") {
        try {
          const descriptor = Object.getOwnPropertyDescriptor(
            originalFastify,
            key
          );
          if (descriptor) {
            Object.defineProperty(enhancedFastify, key, descriptor);
          }
        } catch (e) {}
      }
    });

    return enhancedFastify;
  }

  return result;
};

function matchRoute(url, pattern) {
  const urlParts = url.split("/");
  const patternParts = pattern.split("/");

  if (urlParts.length !== patternParts.length) {
    return false;
  }

  for (let i = 0; i < urlParts.length; i++) {
    if (!patternParts[i].startsWith(":") && urlParts[i] !== patternParts[i]) {
      return false;
    }
  }

  return true;
}

const instrumentations = getNodeAutoInstrumentations({
  ...disabledInstrumentations,

  "@opentelemetry/instrumentation-http": {
    enabled: !disabledInstrumentations["@opentelemetry/instrumentation-http"],
    requestHook: (span, request) => {
      try {
        span.setAttributes({
          "http.request.id":
            request.headers["x-request-id"] ||
            request.headers["x-correlation-id"] ||
            request.headers["x-trace-id"] ||
            `req-${Date.now()}`,
          "http.user_agent": request.headers["user-agent"] || "unknown",
          "http.real_ip":
            request.headers["x-real-ip"] ||
            request.headers["x-forwarded-for"] ||
            "unknown",
          "http.host": request.headers["host"] || "unknown",
          "http.original_url": request.url || "unknown",
        });

        if (global.__ROUTE_REGISTRY__ && global.__ROUTE_REGISTRY__.size > 0) {
          const method = request.method;
          const url = (request.url || "").split("?")[0];

          for (const [key, route] of global.__ROUTE_REGISTRY__.entries()) {
            if (
              key.startsWith(`${method}:`) &&
              matchRoute(url, route.pattern)
            ) {
              span.setAttribute("http.route", route.pattern);
              break;
            }
          }
        }
      } catch (e) {}
    },
    responseHook: (span, response) => {
      try {
        span.setAttributes({
          "http.response.size":
            response.headers?.["content-length"] || "unknown",
          "http.response.content_type":
            response.headers?.["content-type"] || "unknown",
        });
      } catch (e) {}
    },
  },

  "@opentelemetry/instrumentation-fastify": {
    enabled:
      !disabledInstrumentations["@opentelemetry/instrumentation-fastify"],
    requestHook: (span, { request }) => {
      try {
        let routePattern = null;

        if (request.routeOptions) {
          routePattern = request.routeOptions.url;
        } else if (request.context?.config) {
          routePattern = request.context.config.url;
        }

        if (routePattern) {
          span.setAttributes({
            "http.route": routePattern,
            "fastify.route.pattern": routePattern,
          });
        }
      } catch (e) {}
    },
  },

  "@opentelemetry/instrumentation-express": {
    enabled:
      !disabledInstrumentations["@opentelemetry/instrumentation-express"],
  },
  "@opentelemetry/instrumentation-koa": {
    enabled: !disabledInstrumentations["@opentelemetry/instrumentation-koa"],
  },
  "@opentelemetry/instrumentation-graphql": {
    enabled:
      !disabledInstrumentations["@opentelemetry/instrumentation-graphql"],
  },
  "@opentelemetry/instrumentation-mysql": {
    enabled: !disabledInstrumentations["@opentelemetry/instrumentation-mysql"],
  },
  "@opentelemetry/instrumentation-mysql2": {
    enabled: !disabledInstrumentations["@opentelemetry/instrumentation-mysql2"],
  },
  "@opentelemetry/instrumentation-pg": {
    enabled: !disabledInstrumentations["@opentelemetry/instrumentation-pg"],
  },
  "@opentelemetry/instrumentation-mongodb": {
    enabled:
      !disabledInstrumentations["@opentelemetry/instrumentation-mongodb"],
  },
  "@opentelemetry/instrumentation-redis": {
    enabled: !disabledInstrumentations["@opentelemetry/instrumentation-redis"],
  },
  "@opentelemetry/instrumentation-dns": {
    enabled: !disabledInstrumentations["@opentelemetry/instrumentation-dns"],
  },
  "@opentelemetry/instrumentation-net": {
    enabled: !disabledInstrumentations["@opentelemetry/instrumentation-net"],
  },
  "@opentelemetry/instrumentation-fs": {
    enabled: !disabledInstrumentations["@opentelemetry/instrumentation-fs"],
  },
  "@opentelemetry/instrumentation-aws-sdk": {
    enabled:
      !disabledInstrumentations["@opentelemetry/instrumentation-aws-sdk"],
  },
});

const sdk = new NodeSDK({
  instrumentations,
});

if (process.env.OTEL_LOG_LEVEL === "debug") {
  try {
    const {
      diag,
      DiagConsoleLogger,
      DiagLogLevel,
    } = require("@opentelemetry/api");
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  } catch (e) {
    console.warn("Could not setup debug logging:", e.message);
  }
}

try {
  sdk.start();

  setTimeout(() => {
    if (!global.__METRICS_REGISTRY__) {
      initCustomMetrics();
    }
  }, 5000);

  console.log("OpenTelemetry instrumentation started");
  console.log(`Service: ${process.env.OTEL_SERVICE_NAME}`);
} catch (error) {
  console.error("Failed to start OpenTelemetry instrumentation:", error);
}

const shutdown = async () => {
  try {
    await sdk.shutdown();
  } catch (error) {
    console.error("Error during OpenTelemetry shutdown:", error);
  }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

module.exports = { sdk };
