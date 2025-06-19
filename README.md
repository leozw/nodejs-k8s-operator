# 🚀 Universal OpenTelemetry Node.js Instrumentation

Universal OpenTelemetry instrumentation for Node.js applications that **guarantees `http.route` labels** in all metrics, across any framework.

## ✨ Key Features

- **🎯 Universal Compatibility** — Works with any Node.js HTTP framework.
- **📊 Precise Route Labels** — Captures clean `http.route` labels even for dynamic routes.
- **🔧 Zero Configuration** — Drop-in replacement for standard OpenTelemetry agents.
- **🏷️ Standards-Based Metrics** — Follows OpenTelemetry semantic conventions.
- **🚀 Production Ready** — Lightweight, optimized, no debug noise.

## 🎯 Supported Frameworks

| Framework | Compatibility | Route Label Example |
| --- | --- | --- |
| **Express** | ✅ Full | `/users/:id` |
| **Fastify** | ✅ Full | `/users/:id` |
| **Next.js** | ✅ Full | `/api/users/[id]` |
| **NestJS** | ✅ Full | `/users/:id` |
| **Koa** | ✅ Full | `/users/:id` |
| **GraphQL** | ✅ Full | `/graphql` |

> Other HTTP frameworks may work out-of-the-box due to universal require() interception.
> 

---

## 📊 Metrics Created

The following OpenTelemetry-compliant metrics are automatically generated for all instrumented HTTP traffic:

Each metric includes these standard labels:

- `http_route` — normalized route pattern (e.g. `/users/:id`)
- `http_method` — HTTP method (`GET`, `POST`, etc)
- `http_status_code` — HTTP response status code
- `service_name` — application service identifier

| Metric | Description |
| --- | --- |
| **`http_server_duration_milliseconds`** | Server-side request processing duration (latency observed by server). |
| **`http_client_duration_milliseconds`** | Client-side request duration (latency observed by client, if applicable). |
| **`http_requests_total`** | Total number of HTTP requests processed. |
| **`http_request_size_bytes`** | Size of incoming HTTP requests (payload + headers). |
| **`http_response_size_bytes`** | Size of outgoing HTTP responses (payload + headers). |

> 🔎 Histogram Format:
> 
> 
> Each metric follows the Prometheus histogram format, exposing `_bucket`, `_count`, and `_sum` suffixes for advanced distribution analysis, totals, and quantile calculations.
> 

---

## 🚀 Quick Start

### 1️⃣ Build the Instrumentation Image

```bash
chmod +x build.sh
./build.sh
```

### 2️⃣ Deploy Instrumentation to Your Cluster

```bash
kubectl apply -f instrumentation.yaml
```

### 3️⃣ Annotate Your Node.js Applications

Add the following annotation to your Kubernetes Deployment:

```yaml
metadata:
  annotations:
    instrumentation.opentelemetry.io/inject-nodejs: "true"
```

### 4️⃣ Restart Deployments

```bash
kubectl rollout restart deployment/your-nodejs-app
```

Your application is now fully instrumented — no code changes required.

---

## 📈 Grafana Usage Examples

### Request Rate by Route

```
rate(http_requests_total{http_route="/users/:id"}[5m])
```

### 95th Percentile Request Duration

```
histogram_quantile(0.95, rate(http_server_duration_milliseconds_bucket{http_route="/api/orders"}[5m]))
```

### Error Rate by Route

```
rate(http_requests_total{http_route="/users/:id", http_status_code=~"5.."}[5m])
```

---

## 🔧 Configuration Options

### Environment Variables

| Variable | Description |
| --- | --- |
| `OTEL_NODE_DISABLED_INSTRUMENTATIONS` | Disable specific OpenTelemetry instrumentations if needed |
| `OTEL_LOG_LEVEL` | Set log verbosity (`debug` for troubleshooting) |
| `OTEL_RESOURCE_ATTRIBUTES` | Add custom resource-level attributes |

### Deployment Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-nodejs-app
spec:
  template:
    metadata:
      annotations:
        instrumentation.opentelemetry.io/inject-nodejs: "true"
    spec:
      containers:
      - name: app
        image: my-nodejs-app:latest
```

---

## 🔍 Troubleshooting

### Verify Instrumentation

```bash
kubectl get instrumentation instrumentation -o yaml
```

### Check Application Logs

```bash
kubectl logs deployment/your-app | grep "OpenTelemetry"
```

Expected log:

```
OpenTelemetry instrumentation started
Service: your-app-name
```

### Validate Metrics in Grafana

Look for metrics containing:

- `http_route="/users/:id"`
- `http_method="GET"`
- `http_status_code="200"`

---

## 📝 License

**MIT License** — Fully open-source, production-ready, and free to use.

---

🎯 *Instant full observability for your Node.js applications — with correct route labeling — out of the box.*