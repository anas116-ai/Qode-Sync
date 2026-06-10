# API Documentation

## Authentication

### POST /api/v1/auth/login-pat
Login with GitHub Personal Access Token.

**Request Body**: Plain text PAT

**Response**: 
```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "github_pat_status": "valid"
}
```

### GET /api/v1/auth/profile
Get current user profile.

**Query**: user_id

**Response**: UserProfileResponse

---

## Repositories

### GET /api/v1/repositories
List user's forked repositories.

**Query Params**:
- user_id: string (required)
- page: int (default: 1)
- page_size: int (default: 20)

**Response**:
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

### POST /api/v1/repositories/sync
Trigger full fork sync.

**Query**: user_id

**Response**: 
```json
{ "success": true, "message": "Synced 50 forks" }
```

---

## Updates

### GET /api/v1/updates
List repository updates.

**Query Params**:
- user_id: string (required)
- status: string (optional: new|viewed|synced|ignored)
- page: int

**Response**: Paginated updates list

### POST /api/v1/updates/{id}/acknowledge
Mark update as viewed.

**Response**: 
```json
{ "success": true }
```

---

## Analytics

### GET /api/v1/analytics/stats
Get dashboard statistics.

**Response**:
```json
{
  "total_forks": 150,
  "updated_forks": 42,
  "critical_updates": 5,
  "last_sync": "2026-06-09T10:00:00Z"
}
```

---

## Sync

### GET /api/v1/sync/status
Get sync job status.

**Query**: user_id

**Response**: List of recent sync jobs

### POST /api/v1/sync/trigger
Trigger manual sync.

**Response**:
```json
{ "success": true, "job_id": "uuid" }
```

---

## Notifications

### GET /api/v1/notifications
List notifications.

### POST /api/v1/notifications/rules
Create notification rule.

### POST /api/v1/notifications/test
Send test notification.

---

## Error Responses

All endpoints return:
```json
{
  "error": "Error message",
  "detail": "Additional details"
}
```