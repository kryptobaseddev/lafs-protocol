# LAFS Troubleshooting Guide

**Version:** 1.1.0  
**Purpose:** Common issues and solutions for LAFS deployments

---

## Quick Diagnostics

### Health Check Failed

**Symptoms:**
```
curl http://localhost:3000/health
# Returns: 503 Service Unavailable
```

**Diagnosis:**
```bash
# Check service status
docker ps | grep lafs

# Check logs
docker logs lafs-api --tail 50

# Check port binding
netstat -tlnp | grep 3000
```

**Solutions:**

1. **Service not running:**
   ```bash
   docker-compose up -d lafs-api
   ```

2. **Port already in use:**
   ```bash
   # Find process using port
   lsof -i :3000
   
   # Kill process or change port
   export PORT=3001
   ```

3. **Health check endpoint missing:**
   ```typescript
   // Add to your server
   app.get('/health', (req, res) => {
     res.json({ status: 'healthy', version: '1.1.0' });
   });
   ```

---

## Common Errors

### E_VALIDATION_SCHEMA

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "E_VALIDATION_SCHEMA",
    "message": "Envelope validation failed"
  }
}
```

**Causes:**
1. Missing required fields
2. Invalid field types
3. Schema version mismatch

**Solutions:**

1. **Check required fields:**
   ```typescript
   // Required: $schema, _meta, success
   const envelope = {
     $schema: "https://lafs.dev/schemas/v1/envelope.schema.json",
     _meta: {
       specVersion: "1.0.0",
       operation: "test",
       requestId: "req_123"
     },
     success: true
   };
   ```

2. **Validate before sending:**
   ```typescript
   import { validateEnvelope } from '@cleocode/lafs-protocol';
   
   const result = validateEnvelope(envelope);
   if (!result.valid) {
     console.error(result.errors);
   }
   ```

3. **Check schema version:**
   ```bash
   curl http://localhost:3000/schema/version
   ```

### E_MVI_BUDGET_EXCEEDED

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "E_MVI_BUDGET_EXCEEDED",
    "message": "Response exceeds token budget"
  }
}
```

**Causes:**
1. Response too large
2. Budget set too low
3. No truncation configured

**Solutions:**

1. **Increase budget:**
   ```typescript
   const server = new LAFSServer({
     maxTokens: 8000  // Increase from default 4000
   });
   ```

2. **Enable truncation:**
   ```typescript
   const server = new LAFSServer({
     truncationStrategy: 'depth-first'
   });
   ```

3. **Request smaller response:**
   ```typescript
   const request = {
     _budget: { maxTokens: 4000 },
     _fields: ['id', 'name']  // Limit fields
   };
   ```

### Circuit Breaker Open

**Error:**
```
CircuitBreakerError: Circuit breaker is OPEN
```

**Symptoms:**
- Requests failing immediately
- No attempts to downstream service
- Error rate: 100%

**Diagnosis:**
```bash
# Check circuit breaker status
curl http://localhost:3000/circuit-breakers | jq

# Check downstream service
curl http://downstream-service/health
```

**Solutions:**

1. **Check downstream service:**
   ```bash
   # Verify downstream is healthy
   curl http://dependency/health
   
   # Check network connectivity
   telnet dependency-host dependency-port
   ```

2. **Wait for auto-reset:**
   - Circuit breaker resets after timeout (default: 30s)
   - Monitor status: `watch curl http://localhost:3000/circuit-breakers`

3. **Manual reset (emergency):**
   ```bash
   curl -X POST http://localhost:3000/circuit-breakers/reset
   ```

4. **Adjust thresholds:**
   ```typescript
   const breaker = new CircuitBreaker({
     failureThreshold: 10,  // Increase from default 5
     resetTimeout: 60000    // Increase from default 30000
   });
   ```

### E_FORMAT_CONFLICT

**Error:**
```
Error: E_FORMAT_CONFLICT: Cannot combine --human and --json
```

**Solution:**
Use only one output format flag:
```bash
# Correct
lafs-conformance --envelope test.json --human
lafs-conformance --envelope test.json --json

# Incorrect
lafs-conformance --envelope test.json --human --json
```

---

## Performance Issues

### High Memory Usage

**Symptoms:**
- Memory usage > 90%
- OOM kills
- Slow garbage collection

**Diagnosis:**
```bash
# Check memory usage
docker stats lafs-api

# Check Node.js heap
curl http://localhost:3000/metrics | grep heap

# Generate heap dump
curl -X POST http://localhost:3000/admin/heapdump
```

**Solutions:**

1. **Enable response caching:**
   ```typescript
   const server = new LAFSServer({
     cache: {
       enabled: true,
       ttl: 300  // 5 minutes
     }
   });
   ```

2. **Limit request size:**
   ```typescript
   app.use(express.json({ limit: '1mb' }));
   ```

3. **Increase memory limit:**
   ```bash
   node --max-old-space-size=4096 server.js
   ```

### High Latency

**Symptoms:**
- p99 latency > 2s
- Timeouts
- Queue buildup

**Diagnosis:**
```bash
# Check latency metrics
curl http://localhost:3000/metrics | grep latency

# Check active connections
curl http://localhost:3000/metrics | grep connections

# Profile performance
node --prof server.js
```

**Solutions:**

1. **Scale horizontally:**
   ```bash
   kubectl scale deployment lafs-api --replicas=5
   ```

2. **Enable connection pooling:**
   ```typescript
   const server = new LAFSServer({
     connectionPool: {
       min: 5,
       max: 20
     }
   });
   ```

3. **Add caching:**
   ```typescript
   const cache = new LRUCache({
     max: 1000,
     ttl: 1000 * 60 * 5
   });
   ```

### Slow Schema Validation

**Symptoms:**
- Validation taking > 100ms
- CPU spikes during validation

**Solutions:**

1. **Pre-compile schemas:**
   ```typescript
   import { compileSchema } from '@cleocode/lafs-protocol';
   
   // Compile once at startup
   const compiledSchema = compileSchema(envelopeSchema);
   
   // Use compiled schema
   const result = validateEnvelope(envelope, compiledSchema);
   ```

2. **Cache validation results:**
   ```typescript
   const validationCache = new Map();
   
   function validateWithCache(envelope) {
     const key = JSON.stringify(envelope);
     if (validationCache.has(key)) {
       return validationCache.get(key);
     }
     const result = validateEnvelope(envelope);
     validationCache.set(key, result);
     return result;
   }
   ```

---

## A2A Integration Issues

### A2A Connection Failed

**Error:**
```
Error: Failed to connect to A2A agent
```

**Diagnosis:**
```bash
# Check agent card
curl http://agent.example.com/.well-known/agent-card.json

# Check connectivity
nc -zv agent.example.com 443
```

**Solutions:**

1. **Verify Agent Card:**
   ```bash
   curl -s http://agent.example.com/.well-known/agent-card.json | jq
   ```

2. **Check authentication:**
   ```typescript
   const client = await factory.createFromUrl('http://agent.example.com', {
     authentication: {
       type: 'apiKey',
       apiKey: process.env.A2A_API_KEY
     }
   });
   ```

3. **Verify protocol version:**
   ```typescript
   // Ensure version compatibility
   if (agentCard.protocolVersion !== '1.0') {
     throw new Error('Protocol version mismatch');
   }
   ```

### LAFS Envelope Not Found in A2A Response

**Symptoms:**
- `getLafsEnvelope()` returns null
- Artifacts present but no LAFS data

**Solutions:**

1. **Verify envelope is in artifact:**
   ```typescript
   const artifact = {
     name: 'lafs_response',
     parts: [{
       kind: 'data',
       data: envelope  // LAFS envelope here
     }]
   };
   ```

2. **Check envelope format:**
   ```typescript
   // Must have these fields
   const envelope = {
     $schema: "...",
     _meta: { ... },
     success: true,
     result: { ... }
   };
   ```

---

## MCP Integration Issues

### MCP Tool Not Returning LAFS Envelope

**Symptoms:**
- Tool returns plain object
- No LAFS metadata

**Solution:**
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const result = await processTool(request);
  
  // Wrap in LAFS envelope
  const envelope = createEnvelope({
    operation: request.params.name,
    success: true,
    result
  });
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(envelope)
    }]
  };
});
```

---

## Graceful Shutdown Issues

### Shutdown Timeout

**Symptoms:**
- Process killed before graceful shutdown
- Active requests dropped

**Solutions:**

1. **Increase shutdown timeout:**
   ```typescript
   gracefulShutdown(server, {
     timeout: 60000  // Increase from default 30s
   });
   ```

2. **Check for hanging requests:**
   ```bash
   # Monitor active connections during shutdown
   watch 'curl -s http://localhost:3000/metrics | grep active'
   ```

3. **Force close connections:**
   ```typescript
   server.close(() => {
     console.log('Server closed');
     // Force exit if needed
     setTimeout(() => process.exit(0), 5000);
   });
   ```

---

## Environment Issues

### Configuration Not Loading

**Symptoms:**
- Default values used instead of env vars
- Missing configuration errors

**Solutions:**

1. **Check env file:**
   ```bash
   cat .env | grep LAFS
   ```

2. **Load order:**
   ```typescript
   // Load env before importing LAFS
   import 'dotenv/config';
   import { LAFSServer } from '@cleocode/lafs-protocol';
   ```

3. **Validate configuration:**
   ```typescript
   const config = {
     port: parseInt(process.env.PORT) || 3000,
     enforceBudgets: process.env.LAFS_ENFORCE_BUDGETS === 'true'
   };
   ```

### Port Already in Use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**

1. **Find and kill process:**
   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. **Use different port:**
   ```bash
   export PORT=3001
   npm start
   ```

3. **Check for zombie processes:**
   ```bash
   ps aux | grep node
   ```

---

## Debug Mode

### Enable Debug Logging

```bash
# Set log level
export LOG_LEVEL=debug

# Or in code
import { setLogLevel } from '@cleocode/lafs-protocol';
setLogLevel('debug');
```

### Debug Endpoints

```typescript
// Add to development only
if (process.env.NODE_ENV === 'development') {
  app.get('/debug/config', (req, res) => {
    res.json({
      config: server.getConfig(),
      env: process.env
    });
  });
  
  app.get('/debug/metrics/detailed', (req, res) => {
    res.json(server.getDetailedMetrics());
  });
}
```

---

## Getting Help

### Before Opening an Issue

1. **Check logs:**
   ```bash
   docker logs lafs-api 2>&1 | grep ERROR
   ```

2. **Verify version:**
   ```bash
   curl http://localhost:3000/version
   ```

3. **Test with minimal config:**
   ```typescript
   const server = new LAFSServer({
     enforceBudgets: false,  // Disable features
     defaultMVI: 'minimal'
   });
   ```

4. **Check documentation:**
   - [Deployment Guide](./deployment.md)
   - [Operational Runbook](./runbook.md)
   - [API Reference](./specification.md)

### Information to Include

When reporting issues:

1. LAFS version
2. Node.js version
3. Deployment environment (Docker, K8s, etc.)
4. Error messages and stack traces
5. Configuration (redact secrets)
6. Steps to reproduce
7. Expected vs actual behavior

### Support Channels

- **GitHub Issues:** https://github.com/kryptobaseddev/lafs-protocol/issues
- **Documentation:** https://codluv.gitbook.io/lafs-protocol/
- **Discussions:** GitHub Discussions

---

## Emergency Procedures

### Complete Service Failure

1. **Immediate response:**
   ```bash
   # Restart service
   docker-compose restart lafs-api
   
   # Or rollback
   docker-compose pull lafs-api:1.0.0
   docker-compose up -d
   ```

2. **Check infrastructure:**
   ```bash
   # Check container resources
   docker stats lafs-api
   
   # Check host resources
   df -h
   free -m
   ```

3. **Preserve evidence:**
   ```bash
   # Save logs
   docker logs lafs-api > /tmp/lafs-logs-$(date +%Y%m%d-%H%M%S).txt
   
   # Save metrics
   curl http://localhost:3000/metrics > /tmp/lafs-metrics.txt
   ```

---

*Troubleshooting Guide v1.1.0*
