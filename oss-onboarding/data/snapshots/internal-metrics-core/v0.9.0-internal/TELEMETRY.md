# Telemetry Specifications - Metrics Core

## Supported Telemetry Metrics
- `cpu_utilization_percent`: Float gauge sampled at 100ms intervals.
- `memory_rss_bytes`: Resident set memory size.
- `socket_roundtrip_ms`: Network roundtrip latency across internal RPC nodes.
- `active_event_loop_lag_us`: Event loop delay in microseconds.

## Buffer Sizing Configuration
Socket buffer sizes are tunable in `/etc/metrics-core.conf`:
- `DEFAULT_RING_SIZE`: 65536 bytes.
- `MAX_BATCH_BURST`: 1048576 bytes.
When network congestion occurs, circular buffers drop lowest-priority debug events to prevent heap memory exhaustion.
