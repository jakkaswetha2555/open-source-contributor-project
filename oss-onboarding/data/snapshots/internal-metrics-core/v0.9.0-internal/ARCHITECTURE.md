# Architecture - Internal Metrics Core

## Pipeline Design
Internal Metrics Core is architected as an ultra-low latency event pipeline:
1. **Socket Ingest Engine:** Non-blocking C++ Node native addon reading kernel telemetry rings.
2. **Buffer Manager:** Pre-allocated circular ring buffer holding real-time performance ticks.
3. **Encryption Dispatcher:** Encrypts outgoing metrics batches with AES-256-GCM before pushing to private Prometheus/Kafka clusters.

## Isolation Boundaries
This system communicates exclusively across private VPC subnets. External internet connectivity is disallowed by egress firewall policies.
