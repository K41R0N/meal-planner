# MCP standards findings — October 27, 2026

The primary MCP specification at revision 2026-07-28 uses a stateless core: protocol metadata belongs to each request; Streamable HTTP carries POSTs to a single endpoint, with JSON or request-scoped SSE replies. Earlier initialization/session-based versions require an explicit compatibility path. Do not force new transport assumptions onto clients whose supported versions have not been tested.

Primary sources:
- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports
- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
- https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning

The current authorization specification requires protected-resource metadata, OAuth authorization-server discovery, per-request bearer authorization, correct audience/resource validation and no token passthrough. Client ID metadata documents are preferred where supported; dynamic registration is retained as a backward-compatibility option, not an unconditional universal dependency.

Primary sources:
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices

Tools should declare input/output schemas and return structured content plus a compatible text representation. Tool annotations are hints, not an authorization mechanism. Tool state is held by explicit opaque application handles, not an assumed MCP connection session; ownership is validated every call.

Primary source:
- https://modelcontextprotocol.io/specification/2026-07-28/server/tools

Architectural implication: state lives in Mealbook's authoritative account-scoped records, approval store and job store; MCP processes remain disposable. Recipe/external-source text stays untrusted data, and numeric validation, consent, entitlements and real-world state transitions cannot be delegated to the reasoning client.
