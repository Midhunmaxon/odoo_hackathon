# Catalog Module API Documentation

For the comprehensive API documentation covering both Catalog and Subscriptions modules, concurrency controls, EXPLAIN ANALYZE optimizations, and pagination standards, please see:

- [Subscriptions & Catalog API Reference](../subscriptions/API.md)

### Quick Route Summary

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/catalog/products` | Paginated product list with variants | Public / Authenticated |
| `GET` | `/api/catalog/products/:id` | Single product details with variants | Public / Authenticated |
| `POST` | `/api/catalog/products` | Create product with variants | `ADMIN` |
| `PATCH` | `/api/catalog/products/:id` | Update product | `ADMIN` |
| `DELETE` | `/api/catalog/products/:id` | Delete product | `ADMIN` |
| `GET` | `/api/catalog/plans` | Paginated subscription plans list | Public / Authenticated |
| `GET` | `/api/catalog/plans/:id` | Single plan details | Public / Authenticated |
| `POST` | `/api/catalog/plans` | Create subscription plan | `ADMIN` |
| `PATCH` | `/api/catalog/plans/:id` | Update subscription plan | `ADMIN` |
| `POST` | `/api/plans/:id/close` | Close plan (requires `allow_close: true`) | `ADMIN` |
| `POST` | `/api/plans/:id/pause` | Pause plan (requires `allow_pause: true`) | `ADMIN` |
| `POST` | `/api/plans/:id/renew` | Renew plan (requires `allow_renew: true`) | `ADMIN` |
