#!/bin/bash

echo "🚀 Building Universal OpenTelemetry Node.js Instrumentation"
echo "📊 Features: http.route labels for all Node.js frameworks"

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f Dockerfile.operator \
  -t leonardozwirtes/nodejs-k8s-operator:v1.0.0 \
  -t leonardozwirtes/nodejs-k8s-operator:universal \
  --push \
  .

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "📦 Images:"
    echo "   leonardozwirtes/nodejs-k8s-operator:v1.0.0"
    echo "   leonardozwirtes/nodejs-k8s-operator:universal"
    echo ""
    echo "🎯 Supported Frameworks:"
    echo "   ✅ Express    - http.route labels"
    echo "   ✅ Fastify    - http.route labels"
    echo "   ✅ Next.js    - http.route labels"
    echo "   ✅ NestJS     - http.route labels"
    echo "   ✅ Koa        - http.route labels"
    echo "   ✅ GraphQL    - query/mutation labels"
    echo ""
    echo "📊 Metrics Created:"
    echo "   ✅ http_server_duration_milliseconds{http_route}"
    echo "   ✅ http_requests_total{http_route}"
    echo "   ✅ http_request_size_bytes{http_route}"
    echo "   ✅ http_response_size_bytes{http_route}"
    echo ""
    echo "🚀 Deploy:"
    echo "   kubectl apply -f your-instrumentation.yaml"
    echo "   kubectl rollout restart deployment/your-app"
    echo ""
    echo "🎉 Ready for production use!"
else
    echo "❌ Build failed!"
    exit 1
fi