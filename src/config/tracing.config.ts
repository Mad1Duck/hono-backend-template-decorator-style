import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import {
  SimpleSpanProcessor,
  BatchSpanProcessor,
  ConsoleSpanExporter,
  type SpanProcessor,
  SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { env, isDevelopment } from './env.config';

const ATTR_SERVICE_NAME = 'service.name' as const;
const ATTR_SERVICE_VERSION = 'service.version' as const;
const ATTR_DEPLOYMENT_ENVIRONMENT = 'deployment.environment' as const;

// ==================== TYPED EXPORTER FACTORY ====================
// OTLPTraceExporter constructor returns \`any\` in its type declarations.
// Wrapping in a function with an explicit return type satisfies ESLint
// no-unsafe-assignment without needing \`as unknown as\` casts or disabling rules.
function createOtlpExporter(url: string): SpanExporter {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return new OTLPTraceExporter({
    url,
  }) as SpanExporter;
}


// ==================== INIT ====================

/**
 * Initialize OpenTelemetry tracing.
 * Must be called as the VERY FIRST line in server.ts — before any other import.
 */
export function initTracing(serviceName: string): NodeTracerProvider {
  const spanProcessors: SpanProcessor[] = [];

  if (isDevelopment) {
    spanProcessors.push(
      new SimpleSpanProcessor(new ConsoleSpanExporter())
    );
  }

  if (env.OTLP_ENDPOINT) {
    const exporter = createOtlpExporter(
      `${env.OTLP_ENDPOINT}/v1/traces`
    );

    spanProcessors.push(
      new BatchSpanProcessor(exporter as unknown as ConstructorParameters<typeof BatchSpanProcessor>[0], {
        maxQueueSize: 2048,
        maxExportBatchSize: 512,
        scheduledDelayMillis: 5000,
      })
    );
  }

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: '1.0.0',
      [ATTR_DEPLOYMENT_ENVIRONMENT]: env.NODE_ENV,
    }),
    spanProcessors,
  });

  provider.register();

  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => {
          const url = req.url ?? '';
          return url === '/health' || url === '/metrics';
        },
      }),
      new PgInstrumentation(),
      new RedisInstrumentation(),
    ],
  });

  console.log(
    `Tracing initialized for \${serviceName} (otlp: \${env.OTLP_ENDPOINT ?? 'console-only'})`
  );

  return provider;
}