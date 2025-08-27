# CORS Multi-Tenant API Documentation

## Overview
This document describes the CORS (Cross-Origin Resource Sharing) management system for multi-tenant applications. The system allows each tenant to manage their own list of allowed origins with support for wildcards, regex patterns, and automatic suggestions.

## Features
- ✅ Dynamic CORS configuration per tenant
- ✅ Support for wildcards and regex patterns
- ✅ Automatic caching for performance
- ✅ Access logging and statistics
- ✅ Smart origin suggestions based on blocked requests
- ✅ Development mode with localhost support
- ✅ RESTful API for management

## API Endpoints

### Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

### Base URL
```
/api/cors
```

---

## 1. Get Allowed Origins
Get the list of allowed origins for the authenticated tenant.

**Endpoint:** `GET /api/cors/origins`

**Response:**
```json
{
  "success": true,
  "origins": [
    "https://app.example.com",
    "https://www.example.com",
    "*.subdomain.example.com"
  ],
  "patterns": {
    "wildcards": ["*.subdomain.example.com"],
    "regex": [],
    "exact": ["https://app.example.com", "https://www.example.com"]
  }
}
```

---

## 2. Add Allowed Origin
Add a new allowed origin for the tenant.

**Endpoint:** `POST /api/cors/origins`

**Request Body:**
```json
{
  "origin": "https://new-app.example.com"
}
```

**Supported Formats:**
- Exact URL: `https://app.example.com`
- Wildcard all: `*`
- Subdomain wildcard: `*.example.com`
- Port wildcard: `http://localhost:*`
- Regex pattern: `/^https:\/\/.*\.example\.com$/`

**Response:**
```json
{
  "success": true,
  "message": "Origin added successfully",
  "origins": ["https://app.example.com", "https://new-app.example.com"]
}
```

---

## 3. Remove Allowed Origin
Remove an allowed origin from the tenant's list.

**Endpoint:** `DELETE /api/cors/origins`

**Request Body:**
```json
{
  "origin": "https://old-app.example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Origin removed successfully",
  "origins": ["https://app.example.com"]
}
```

---

## 4. Update All Origins
Replace the entire list of allowed origins.

**Endpoint:** `PUT /api/cors/origins`

**Request Body:**
```json
{
  "origins": [
    "https://app.example.com",
    "*.api.example.com",
    "http://localhost:*"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Origins updated successfully",
  "origins": ["https://app.example.com", "*.api.example.com", "http://localhost:*"]
}
```

---

## 5. Validate Origin
Check if a specific origin is allowed for the tenant.

**Endpoint:** `POST /api/cors/validate`

**Request Body:**
```json
{
  "origin": "https://app.example.com"
}
```

**Response (Allowed):**
```json
{
  "success": true,
  "allowed": true,
  "reason": "Origin allowed",
  "matchedPattern": "https://app.example.com"
}
```

**Response (Blocked):**
```json
{
  "success": true,
  "allowed": false,
  "reason": "Origin not in whitelist",
  "suggestion": "*.example.com"
}
```

---

## 6. Get CORS Statistics
Get access statistics for the tenant.

**Endpoint:** `GET /api/cors/stats`

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalRequests": 1543,
    "allowed": [
      {
        "origin": "https://app.example.com",
        "count": 1200,
        "lastAccess": "2024-01-15T10:30:00Z"
      }
    ],
    "blocked": [
      {
        "origin": "https://unknown.com",
        "count": 43,
        "lastAccess": "2024-01-15T09:15:00Z"
      }
    ]
  }
}
```

---

## 7. Get Suggested Origins
Get suggestions for origins that have been frequently blocked.

**Endpoint:** `GET /api/cors/suggestions`

**Response:**
```json
{
  "success": true,
  "suggestions": [
    {
      "origin": "https://staging.example.com",
      "blockedCount": 25,
      "firstBlocked": "2024-01-14T15:00:00Z",
      "lastBlocked": "2024-01-15T10:00:00Z",
      "suggestedPattern": "*.example.com"
    }
  ]
}
```

---

## 8. Clear Cache
Clear the CORS cache for the tenant.

**Endpoint:** `POST /api/cors/cache/clear`

**Response:**
```json
{
  "success": true,
  "message": "Cache cleared successfully"
}
```

---

## 9. Health Check
Check the health status of the CORS service.

**Endpoint:** `GET /api/cors/health`

**Response:**
```json
{
  "success": true,
  "health": {
    "status": "healthy",
    "cache": {
      "keys": 5,
      "stats": 3,
      "size": "2.3 KB"
    },
    "stats": {
      "totalAllowed": 5420,
      "totalBlocked": 234,
      "tenants": 12
    },
    "uptime": "4h 32m"
  }
}
```

---

## Pattern Examples

### Wildcard Patterns

| Pattern | Matches | Doesn't Match |
|---------|---------|---------------|
| `*` | All origins | None |
| `*.example.com` | `app.example.com`, `api.example.com`, `example.com` | `example.org` |
| `http://localhost:*` | `http://localhost:3000`, `http://localhost:5173` | `https://localhost:3000` |
| `https://*.*.example.com` | `https://api.v1.example.com` | `https://api.example.com` |

### Regex Patterns

| Pattern | Matches | Doesn't Match |
|---------|---------|---------------|
| `/^https:\/\/.*\.example\.com$/` | `https://app.example.com` | `http://app.example.com` |
| `/^https?:\/\/localhost(:\d+)?$/` | `http://localhost`, `https://localhost:3000` | `http://127.0.0.1` |
| `/^https:\/\/(app\|api)\.example\.com$/` | `https://app.example.com`, `https://api.example.com` | `https://web.example.com` |

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid origin format: <details>"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "message": "Insufficient permissions"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "An error occurred processing your request"
}
```

---

## Development Mode

In development mode (`NODE_ENV=development`), the following origins are automatically allowed:
- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:5173`
- `http://localhost:8080`
- `http://127.0.0.1:3000`
- `http://127.0.0.1:5173`

---

## Best Practices

1. **Use Specific Origins**: Prefer exact URLs over wildcards when possible for better security.

2. **Review Statistics Regularly**: Check blocked origins to identify legitimate services that need access.

3. **Use Suggestions**: The system automatically suggests patterns based on blocked requests.

4. **Cache Management**: The cache is automatically managed, but you can clear it if you make direct database changes.

5. **Pattern Testing**: Use the validation endpoint to test patterns before adding them.

6. **Security Considerations**:
   - Never use `*` in production unless absolutely necessary
   - Be careful with subdomain wildcards (`*.example.com`)
   - Review and audit allowed origins regularly
   - Remove unused origins promptly

---

## Integration Example

### Frontend Configuration
```javascript
// Frontend API client
const apiClient = axios.create({
  baseURL: 'https://api.example.com',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  withCredentials: true
});

// Handle CORS errors
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 0) {
      console.error('CORS error - origin not allowed');
      // Notify admin to add origin
    }
    return Promise.reject(error);
  }
);
```

### Backend Middleware Usage
```javascript
// Already configured in server.js
const dynamicCors = require('./middleware/dynamicCors');
app.use(dynamicCors);

// For specific routes
router.get('/api/protected', 
  dynamicCors,
  authenticate,
  (req, res) => {
    // Route handler
  }
);
```

---

## Monitoring and Alerts

### Recommended Metrics to Monitor
1. **High Block Rate**: Alert if blocked requests > 20% of total
2. **New Origin Patterns**: Alert when new origins are repeatedly blocked
3. **Cache Hit Rate**: Monitor cache effectiveness
4. **Response Time**: Track CORS validation performance

### Example Alert Configuration
```javascript
// Check for high block rate
const stats = await corsService.getStats(tenantId);
const blockRate = stats.blocked.reduce((sum, b) => sum + b.count, 0) / stats.totalRequests;

if (blockRate > 0.2) {
  // Send alert to admin
  notifyAdmin({
    type: 'CORS_HIGH_BLOCK_RATE',
    tenant: tenantId,
    blockRate: blockRate,
    suggestions: await corsService.getSuggestedOrigins(tenantId)
  });
}
```

---

## Migration from Static CORS

If migrating from static CORS configuration:

1. **Export Current Origins**:
```javascript
// Get current static CORS config
const staticOrigins = [
  'https://app.example.com',
  'https://www.example.com'
];
```

2. **Import to Tenant**:
```javascript
// Update tenant with origins
await Tenant.findByIdAndUpdate(tenantId, {
  $set: { allowedOrigins: staticOrigins }
});
```

3. **Enable Dynamic CORS**:
```javascript
// Replace static CORS with dynamic
// app.use(cors({ origin: staticOrigins })); // Remove this
app.use(dynamicCors); // Add this
```

4. **Verify Configuration**:
```bash
# Test each origin
curl -H "Origin: https://app.example.com" \
     -H "Authorization: Bearer <token>" \
     https://api.example.com/api/cors/validate
```

---

## Troubleshooting

### Common Issues

**1. Origins not being allowed despite being in the list**
- Clear the cache: `POST /api/cors/cache/clear`
- Check origin format matches exactly (including protocol and port)
- Verify tenant ID is correct

**2. Wildcard patterns not working**
- Ensure pattern syntax is correct
- Test with validation endpoint first
- Check for conflicting patterns

**3. Development origins not working**
- Verify `NODE_ENV=development`
- Check that localhost is not explicitly blocked
- Ensure middleware order is correct

**4. Performance issues**
- Monitor cache hit rate
- Consider increasing cache TTL
- Review number of regex patterns (they're slower)

---

## Support

For additional support or questions about the CORS multi-tenant system:
- Check the [API logs](./logs/) for detailed error messages
- Review the [test suite](../tests/corsMultiTenant.test.js) for usage examples
- Contact the development team for assistance

---

*Last updated: January 2024*
